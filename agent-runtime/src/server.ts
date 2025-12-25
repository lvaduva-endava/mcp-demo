import 'dotenv/config';

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  Agent,
  MCPServerStreamableHttp,
  extractAllTextOutput,
  run,
  setDefaultOpenAIKey,
  tool,
} from '@openai/agents';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

import { AGENT_INSTRUCTIONS, HISTORY_PROMPT_PREAMBLE_LINES } from './server-utils.js';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatSession = {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

// =============================================================================
// Constants (keep these aligned & easy to find)
// =============================================================================
const PORT = parseInt(process.env.PORT || '8787', 10);
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || process.env.VITE_MCP_SERVER_URL || 'http://localhost:4000/mcp';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const SESSION_HISTORY_LIMIT = 24;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


if (!OPENAI_API_KEY) {
  // Demo-friendly: allow server to boot but fail requests clearly.
  console.warn(
    '[agent-runtime] Missing API key. Set OPENAI_API_KEY (preferred) or VITE_OPENAI_API_KEY in your environment.'
  );
} else {
  setDefaultOpenAIKey(OPENAI_API_KEY);
}

// =============================================================================
// In-memory state (demo-friendly; no persistence)
// =============================================================================
const sessions = new Map<string, ChatSession>();

let sharedMcpServer: MCPServerStreamableHttp | null = null;
let isMcpServerConnected = false;

let sharedAgent: Agent | null = null;

let sharedMcpClient: Client | null = null;
let isMcpClientConnected = false;

// =============================================================================
// MCP client (direct calls for resources/prompts bridge tools)
// =============================================================================

async function ensureMcpClient(): Promise<Client> {
  if (!sharedMcpClient) {
    sharedMcpClient = new Client({ name: 'agent-runtime', version: '0.1.0' });
  }

  if (!isMcpClientConnected) {
    const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
      // Some MCP servers/SDKs require both JSON + SSE tokens in Accept, even when replying with JSON.
      requestInit: { headers: { Accept: 'application/json, text/event-stream' } },
      // Presentation-friendly: server may return 405 on GET SSE, which the SDK treats as expected.
      reconnectionOptions: {
        initialReconnectionDelay: 500,
        maxReconnectionDelay: 2000,
        reconnectionDelayGrowFactor: 1.5,
        maxRetries: 0,
      },
    });

    await sharedMcpClient.connect(transport);
    isMcpClientConnected = true;
  }

  return sharedMcpClient;
}

function resourceReadResultToText(result: any): string {
  const contents: any[] = Array.isArray(result?.contents) ? result.contents : [];
  if (contents.length === 0) return JSON.stringify(result, null, 2);

  const chunks = contents
    .map((item) => {
      if (typeof item?.text === 'string') return item.text;
      if (typeof item?.blob === 'string') return item.blob;
      return JSON.stringify(item, null, 2);
    })
    .filter((s) => typeof s === 'string' && s.trim().length > 0);

  return chunks.join('\n\n');
}

function getOrCreateSession(sessionId?: string): ChatSession {
  const id = sessionId && typeof sessionId === 'string' ? sessionId : crypto.randomUUID();
  const existing = sessions.get(id);
  if (existing) return existing;

  const now = Date.now();
  const session: ChatSession = {
    id,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  sessions.set(id, session);
  return session;
}

function formatPromptFromHistory(history: ChatMessage[], newUserMessage: string): string {
  const lines: string[] = [];

  // Keep instructions minimal and stable so the model is nudged to use tools.
  lines.push(...HISTORY_PROMPT_PREAMBLE_LINES);

  for (const msg of history) {
    const speaker = msg.role === 'user' ? 'User' : 'Assistant';
    lines.push(`${speaker}: ${msg.content}`);
  }

  lines.push(`User: ${newUserMessage}`);
  lines.push('Assistant:');

  return lines.join('\n');
}

function appendToSessionHistory(session: ChatSession, message: ChatMessage) {
  session.messages.push(message);
  if (session.messages.length > SESSION_HISTORY_LIMIT) {
    session.messages = session.messages.slice(-SESSION_HISTORY_LIMIT);
  }
  session.updatedAt = Date.now();
}

// =============================================================================
// Bridge tools: MCP resources + prompts (explicitly callable by the agent)
// =============================================================================

const mcpReadResourceTool = tool({
  name: 'mcp_read_resource',
  description: 'Read an MCP resource by URI (e.g., dealer://info) and return its content as text.',
  parameters: z.object({
    uri: z.string().describe('Resource URI to read (e.g., dealer://info)'),
  }),
  execute: async ({ uri }) => {
    const client = await ensureMcpClient();
    const result = await client.readResource({ uri });
    return resourceReadResultToText(result);
  },
});

const mcpGetPromptTool = tool({
  name: 'mcp_get_prompt',
  description: 'Fetch an MCP prompt template by name and optional arguments. Returns structured messages.',
  parameters: z.object({
    name: z.string().describe('Prompt name (e.g., sales-quotation)'),
    arguments: z
      .record(z.string())
      .optional()
      .describe('Prompt arguments as string values (shape depends on the prompt).'),
  }),
  execute: async ({ name, arguments: promptArgs }) => {
    const client = await ensureMcpClient();

    const args: Record<string, string> = {};
    if (promptArgs) {
      for (const [key, value] of Object.entries(promptArgs)) {
        if (typeof value === 'string') args[key] = value;
        else args[key] = String(value);
      }
    }

    const result = await client.getPrompt({
      name,
      ...(Object.keys(args).length ? { arguments: args } : {}),
    });
    return result;
  },
});

async function ensureAgent(): Promise<{ agent: Agent; mcpServer: MCPServerStreamableHttp }> {
  if (!sharedMcpServer) {
    sharedMcpServer = new MCPServerStreamableHttp({ url: MCP_SERVER_URL });
  }

  if (!sharedAgent) {
    sharedAgent = new Agent({
      name: 'Dealer Assistant',
      instructions: AGENT_INSTRUCTIONS,
      model: MODEL,
      mcpServers: [sharedMcpServer],
      tools: [mcpReadResourceTool, mcpGetPromptTool],
    });
  }

  if (!isMcpServerConnected) {
    await sharedMcpServer.connect();
    isMcpServerConnected = true;
  }

  return { agent: sharedAgent, mcpServer: sharedMcpServer };
}

// =============================================================================
// Express app
// =============================================================================

const app = express();
app.use(express.json({ limit: '1mb' }));

// Minimal CORS for local dev (React app)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'agent-runtime',
    mcpUrl: MCP_SERVER_URL,
  });
});

// Presentation-friendly JSON API
app.post('/chat', async (req, res) => {
  const message = req.body?.message;
  const sessionId = req.body?.sessionId;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Missing required field: message (string)' });
    return;
  }

  if (!OPENAI_API_KEY) {
    res.status(500).json({
      error:
        'Missing API key. Set OPENAI_API_KEY (preferred) or VITE_OPENAI_API_KEY in the agent-runtime environment.',
    });
    return;
  }

  const session = getOrCreateSession(sessionId);

  try {
    const { agent } = await ensureAgent();

    const prompt = formatPromptFromHistory(session.messages, message);
    const result: any = await run(agent, prompt);

    const assistantText =
      (typeof result?.finalOutput === 'string' && result.finalOutput.trim()) ||
      extractAllTextOutput(result.output) ||
      '';

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: assistantText.trim() || '(No output)',
    };

    appendToSessionHistory(session, { role: 'user', content: message });
    appendToSessionHistory(session, assistantMessage);

    res.status(200).json({ sessionId: session.id, assistant: assistantMessage });
  } catch (e: unknown) {
    const messageText = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: messageText });
  }
});

const server = app.listen(PORT, () => {
  console.log(`[agent-runtime] Listening on http://localhost:${PORT}`);
});

async function shutdown(): Promise<void> {
  console.log('\n[agent-runtime] Shutting down…');
  server.close();

  try {
    if (sharedMcpServer && isMcpServerConnected) {
      await sharedMcpServer.close();
    }
  } catch {
    // ignore
  }

  try {
    if (sharedMcpClient && isMcpClientConnected) {
      await sharedMcpClient.close();
    }
  } catch {
    // ignore
  }

  try {
    process.exit(0);
  } finally {
    // nothing
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
