/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect } from 'react';
import OpenAI from 'openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ChatMessage } from '../types';

import { LOCAL_CHAT_SYSTEM_PROMPT } from './hooks-utils';

// =============================================================================
// Constants (keep these aligned & easy to find)
// =============================================================================
const MCP_SERVER_URL = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:4000/mcp';
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

const OPENAI_MODEL = 'gpt-5-mini';
const MAX_OUTPUT_TOKENS = 1024;
const MAX_TOOL_ITERATIONS = 8;

// OpenAI request limiting (Local LLM mode)
// Notes:
// - Tool use requires extra OpenAI calls (request -> tool calls -> request ...)
// - These limits help avoid hitting RPM caps during demos.
const OPENAI_MAX_REQUESTS_PER_MINUTE = Number(import.meta.env.VITE_OPENAI_MAX_RPM ?? '0');
const OPENAI_MIN_MS_BETWEEN_REQUESTS = Number(import.meta.env.VITE_OPENAI_MIN_MS_BETWEEN_REQUESTS ?? '0');
const OPENAI_MAX_REQUESTS_PER_MESSAGE = Number(
    import.meta.env.VITE_OPENAI_MAX_REQS_PER_MESSAGE ?? String(Math.min(4, MAX_TOOL_ITERATIONS))
);

const MCP_BRIDGE_TOOL_NAMES = {
    readResource: 'mcp_read_resource',
    getPrompt: 'mcp_get_prompt',
} as const;

// =============================================================================
// MCP Transport (JSON-only POST; no SSE GET)
// =============================================================================
type JsonRpcMessage = unknown;

class JsonOnlyStreamableHttpTransport {
    public onclose?: () => void;
    public onerror?: (error: Error) => void;
    public onmessage?: (message: any, extra?: any) => void;

    private readonly url: URL;
    private abortController: AbortController | null = null;
    private _sessionId: string | undefined;
    private protocolVersion: string | undefined;

    constructor(url: URL) {
        this.url = url;
    }

    get sessionId(): string | undefined {
        return this._sessionId;
    }

    setProtocolVersion(version: string): void {
        this.protocolVersion = version;
    }

    async start(): Promise<void> {
        if (this.abortController) {
            throw new Error('Transport already started');
        }
        this.abortController = new AbortController();
    }

    async close(): Promise<void> {
        this.abortController?.abort();
        this.abortController = null;
        this.onclose?.();
    }

    async send(message: JsonRpcMessage | JsonRpcMessage[]): Promise<void> {
        try {
            const headers: Record<string, string> = {
                'content-type': 'application/json',
                // MCP Streamable HTTP servers may require clients to accept both JSON + SSE, even if replies are JSON.
                accept: 'application/json, text/event-stream',
            };

            if (this._sessionId) headers['mcp-session-id'] = this._sessionId;
            if (this.protocolVersion) headers['mcp-protocol-version'] = this.protocolVersion;

            const response = await fetch(this.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(message),
                signal: this.abortController?.signal,
            });

            const sessionId = response.headers.get('mcp-session-id');
            if (sessionId) this._sessionId = sessionId;

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                const serverMessage = payload?.error?.message || payload?.message || response.statusText;
                throw new Error(`MCP HTTP ${response.status}: ${serverMessage}`);
            }

            if (Array.isArray(payload)) {
                for (const msg of payload) this.onmessage?.(msg);
                return;
            }

            this.onmessage?.(payload);
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            this.onerror?.(err);
            throw err;
        }
    }
}

// =============================================================================
// OpenAI Responses: parse helpers
// =============================================================================
function collectAssistantTextFromResponse(response: any): string {
    const outputBlocks = Array.isArray(response?.output) ? response.output : [];
    const textSegments: string[] = [];

    for (const block of outputBlocks) {
        if (block?.type === 'output_text' && block.text) {
            textSegments.push(String(block.text));
            continue;
        }

        if (block?.type === 'message' && Array.isArray(block.content)) {
            for (const part of block.content) {
                if ((part?.type === 'output_text' || part?.type === 'text') && part.text) {
                    textSegments.push(String(part.text));
                }
            }
        }
    }

    // Fallback possibilities
    if (!textSegments.length) {
        if (response?.output_text) textSegments.push(String(response.output_text));
        if (typeof response?.content === 'string') textSegments.push(response.content);
    }

    return textSegments.join('\n').trim();
}

function findPendingToolCalls(response: any): any[] {
    const outputBlocks = Array.isArray(response?.output) ? response.output : [];
    // Support both legacy 'tool_call' and current 'function_call'
    return outputBlocks.filter((block: any) => block?.type === 'tool_call' || block?.type === 'function_call');
}

export function useChat(options?: { enabled?: boolean }) {
    const enabled = options?.enabled ?? true;
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            content: `Hello! I'm your AI car dealership assistant.`
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openaiRef = useRef<OpenAI | null>(null);
    const mcpClientRef = useRef<Client | null>(null);
    const availableToolsRef = useRef<any[]>([]);
    const isInitializedRef = useRef(false);

    // OpenAI request limiting (shared across prompts within this hook instance)
    const openaiRequestTimesRef = useRef<number[]>([]);
    const sendInFlightRef = useRef(false);

    const sleep = useCallback((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), []);

    const waitForOpenAIRateLimit = useCallback(async () => {
        const maxRpm = OPENAI_MAX_REQUESTS_PER_MINUTE;
        const minGapMs = OPENAI_MIN_MS_BETWEEN_REQUESTS;
        if (!Number.isFinite(maxRpm) || maxRpm <= 0) {
            // Disabled by default (set VITE_OPENAI_MAX_RPM to enable)
            if (Number.isFinite(minGapMs) && minGapMs > 0) {
                const times = openaiRequestTimesRef.current;
                const last = times.length ? times[times.length - 1] : 0;
                const now = Date.now();
                const wait = last ? Math.max(0, minGapMs - (now - last)) : 0;
                if (wait > 0) await sleep(wait);
            }
            openaiRequestTimesRef.current.push(Date.now());
            return;
        }

        const windowMs = 60_000;
        const now = Date.now();

        // Prune to sliding window
        openaiRequestTimesRef.current = openaiRequestTimesRef.current.filter((t) => now - t < windowMs);

        // Enforce min gap if configured
        if (Number.isFinite(minGapMs) && minGapMs > 0 && openaiRequestTimesRef.current.length) {
            const last = openaiRequestTimesRef.current[openaiRequestTimesRef.current.length - 1];
            const wait = Math.max(0, minGapMs - (now - last));
            if (wait > 0) await sleep(wait);
        }

        // Enforce RPM by waiting until oldest timestamp falls out of the window
        if (openaiRequestTimesRef.current.length >= maxRpm) {
            const oldest = openaiRequestTimesRef.current[0];
            const wait = Math.max(0, windowMs - (Date.now() - oldest) + 25);
            await sleep(wait);

            // Re-run once after waiting to be safe
            openaiRequestTimesRef.current = openaiRequestTimesRef.current.filter((t) => Date.now() - t < windowMs);
        }

        openaiRequestTimesRef.current.push(Date.now());
    }, [sleep]);

    // =============================================================================
    // Step 1) Initialize OpenAI + MCP
    // =============================================================================
    // Initialize MCP client and OpenAI
    useEffect(() => {
        if (!enabled) return;

        async function initialize() {
            if (isInitializedRef.current) return;

            try {
                if (!OPENAI_API_KEY) {
                    setError('OPENAI_API_KEY not set. Please add it to your .env file as VITE_OPENAI_API_KEY.');
                    return;
                }

                // Initialize OpenAI (browser usage is insecure; demo only)
                openaiRef.current = new OpenAI({
                    apiKey: OPENAI_API_KEY,
                    dangerouslyAllowBrowser: true,
                });

                // Initialize MCP client
                const client = new Client({ name: 'dealer-chat-client', version: '0.1.0' });

                // Presentation-friendly: JSON-only MCP transport (no SSE GET)
                const transport = new JsonOnlyStreamableHttpTransport(new URL(MCP_SERVER_URL));
                await client.connect(transport);
                mcpClientRef.current = client;

                // Step 1b) List tools (and declare them for OpenAI Responses)
                const toolsList = await client.listTools();
                const mcpToolDeclarations = (toolsList?.tools ?? []).map((tool) => ({
                    name: tool.name,
                    type: 'function',
                    description: tool.description,
                    parameters: tool.inputSchema,
                }));

                // Bridge tools: resources/prompts (so the model can call them like normal functions)
                const bridgeToolDeclarations = [
                    {
                        name: MCP_BRIDGE_TOOL_NAMES.readResource,
                        type: 'function',
                        description: 'Read an MCP resource by URI (e.g., dealer://info) and return its contents.',
                        parameters: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                uri: { type: 'string', description: 'Resource URI to read (e.g., dealer://info)' },
                            },
                            required: ['uri'],
                        },
                    },
                    {
                        name: MCP_BRIDGE_TOOL_NAMES.getPrompt,
                        type: 'function',
                        description: 'Fetch an MCP prompt template by name and optional arguments.',
                        parameters: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string', description: 'Prompt name (e.g., sales-quotation)' },
                                arguments: {
                                    type: 'object',
                                    description: 'Prompt arguments (shape depends on the prompt).',
                                    additionalProperties: true,
                                },
                            },
                            required: ['name'],
                        },
                    },
                ];

                availableToolsRef.current = [...mcpToolDeclarations, ...bridgeToolDeclarations];

                isInitializedRef.current = true;
            } catch (err: any) {
                setError(`Initialization failed: ${err.message}`);
                console.error('Chat initialization error:', err);
            }
        }

        initialize();

        return () => {
            if (mcpClientRef.current) {
                mcpClientRef.current.close();
            }
        };
    }, [enabled]);

    // =============================================================================
    // Step 2) Send message (OpenAI Responses loop + MCP tool execution)
    // =============================================================================
    const sendMessage = useCallback(async (userMessage: string) => {
        if (!enabled) {
            setError('Local chat is disabled. Switch modes or enable it.');
            return;
        }
        if (!isInitializedRef.current || !openaiRef.current || !mcpClientRef.current) {
            setError('Chat not initialized. Please refresh the page.');
            return;
        }

        if (sendInFlightRef.current) return;
        sendInFlightRef.current = true;

        setIsLoading(true);
        setError(null);

        // Add user message
        const updatedMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
        setMessages(updatedMessages);

        try {
            // Step 2a) Build the input turns for OpenAI Responses
            const conversationTurns: any[] = [
                { role: 'system', content: LOCAL_CHAT_SYSTEM_PROMPT },
                ...updatedMessages.map((message) => ({ role: message.role, content: message.content })),
            ];

            // Step 2b) Tool loop:
            // - call OpenAI Responses
            // - if it requests tool calls, execute them via MCP
            // - append TOOL_RESULT/TOOL_ERROR back into the conversation
            let assistantReply = '';
            let iterationCount = 0;
            let openaiCallCount = 0;

            while (iterationCount < MAX_TOOL_ITERATIONS) {
                iterationCount += 1;

                if (openaiCallCount >= OPENAI_MAX_REQUESTS_PER_MESSAGE) {
                    assistantReply =
                        `I stopped early to avoid too many OpenAI requests for a single message (cap=${OPENAI_MAX_REQUESTS_PER_MESSAGE}). ` +
                        `Try a simpler prompt, or increase VITE_OPENAI_MAX_REQS_PER_MESSAGE.`;
                    break;
                }

                // -------------------- OpenAI Responses API call --------------------
                await waitForOpenAIRateLimit();
                openaiCallCount += 1;
                const response: any = await openaiRef.current.responses.create({
                    model: OPENAI_MODEL,
                    input: conversationTurns,
                    tools: availableToolsRef.current as any,
                    max_output_tokens: MAX_OUTPUT_TOKENS,
                });

                const pendingToolCalls = findPendingToolCalls(response);
                if (pendingToolCalls.length === 0) {
                    assistantReply = collectAssistantTextFromResponse(response);
                    break;
                }

                // -------------------- Execute MCP tools (parallel) --------------------
                await Promise.all(
                    pendingToolCalls.map(async (toolInvocation: any) => {
                        const toolName = toolInvocation.name;
                        let toolArgs: any = toolInvocation.arguments ?? {};
                        if (typeof toolArgs === 'string') {
                            try { toolArgs = JSON.parse(toolArgs); } catch { /* keep raw */ }
                        }
                        const toolCallId = toolInvocation.call_id || toolInvocation.id;

                        try {
                            if (!mcpClientRef.current) throw new Error('MCP client unavailable');

                            let toolResultText: string;

                            // Bridge: read resource
                            if (toolName === MCP_BRIDGE_TOOL_NAMES.readResource) {
                                const uri = toolArgs?.uri;
                                if (!uri || typeof uri !== 'string') throw new Error('mcp_read_resource requires a string uri');
                                const resourceResult: any = await (mcpClientRef.current as any).readResource({ uri });
                                toolResultText = JSON.stringify(resourceResult, null, 2);
                            }
                            // Bridge: get prompt
                            else if (toolName === MCP_BRIDGE_TOOL_NAMES.getPrompt) {
                                const name = toolArgs?.name;
                                if (!name || typeof name !== 'string') throw new Error('mcp_get_prompt requires a string name');
                                const args = toolArgs?.arguments;
                                const promptResult: any = await (mcpClientRef.current as any).getPrompt({ name, arguments: args });
                                toolResultText = JSON.stringify(promptResult, null, 2);
                            }
                            // Normal MCP tool
                            else {
                                const toolExecution: any = await mcpClientRef.current.callTool({
                                    name: toolName,
                                    arguments: toolArgs,
                                });

                                const toolExecutionText = toolExecution?.content?.[0]?.text || null;
                                toolResultText =
                                    toolExecutionText ||
                                    JSON.stringify({ tool: toolName, arguments: toolArgs, raw: toolExecution });
                            }

                            // Responses API does not accept 'tool' role; attach tool output as user message payload
                            conversationTurns.push({
                                role: 'user',
                                content: `TOOL_RESULT(${toolName} ${toolCallId}):: ${toolResultText}`,
                            });
                        } catch (toolErr: any) {
                            const toolErrorPayload = {
                                tool: toolName,
                                arguments: toolArgs,
                                error: toolErr?.message || 'unknown error',
                            };
                            conversationTurns.push({
                                role: 'user',
                                content: `TOOL_ERROR(${toolName} ${toolCallId}):: ${JSON.stringify(toolErrorPayload)}`,
                            });
                        }
                    })
                );
            }

            if (!assistantReply) assistantReply = "I couldn't generate a response.";

            setMessages((prevMessages) => [...prevMessages, { role: 'assistant', content: assistantReply }]);
        } catch (err: any) {
            setError(err.message || 'Failed to send message');
            console.error('Chat error:', err);
        } finally {
            setIsLoading(false);
            sendInFlightRef.current = false;
        }
    }, [enabled, messages, waitForOpenAIRateLimit]);

    return {
        messages,
        isLoading,
        error,
        sendMessage,
    };
}
