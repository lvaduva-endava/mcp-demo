/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import OpenAI from 'openai';

import type { ChatMessage } from '../types';

// =============================================================================
// Constants (minimal; demo-friendly)
// =============================================================================
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_MODEL = 'gpt-4.1-mini';

// Your public MCP endpoint (e.g. cloudflared URL + /mcp)
const REMOTE_MCP_SERVER_URL = import.meta.env.VITE_REMOTE_MCP_SERVER_URL || '';

const REMOTE_MCP_SERVER_LABEL = import.meta.env.VITE_REMOTE_MCP_SERVER_LABEL || 'dealer-mcp';

// =============================================================================
// Responses parsing (keep tiny)
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

  if (!textSegments.length) {
    if (response?.output_text) textSegments.push(String(response.output_text));
    if (typeof response?.content === 'string') textSegments.push(response.content);
  }

  return textSegments.join('\n').trim();
}

// =============================================================================
// Hook: Remote MCP (Responses API + tools:[{type:'mcp'}])
// =============================================================================
export function useChatRemoteMCP(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm your AI car dealership assistant." },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openaiRef = useRef<OpenAI | null>(null);
  const isInitializedRef = useRef(false);
  const sendInFlightRef = useRef(false);

  // Step 1) Init OpenAI
  useEffect(() => {
    if (!enabled) return;
    if (isInitializedRef.current) return;

    if (!OPENAI_API_KEY) {
      setError('OPENAI_API_KEY not set. Please add it to your .env file as VITE_OPENAI_API_KEY.');
      return;
    }

    openaiRef.current = new OpenAI({ apiKey: OPENAI_API_KEY, dangerouslyAllowBrowser: true });
    isInitializedRef.current = true;
  }, [enabled]);

  // Step 2) Send message (single Responses call; OpenAI handles MCP tool calls internally)
  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!enabled) {
        setError('Remote MCP chat is disabled. Switch modes or enable it.');
        return;
      }
      if (sendInFlightRef.current) return;
      sendInFlightRef.current = true;

      setIsLoading(true);
      setError(null);

      // optimistic: add user message immediately
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

      try {
        if (!openaiRef.current) throw new Error('OpenAI not initialized.');
        if (!REMOTE_MCP_SERVER_URL) {
          throw new Error('Missing VITE_REMOTE_MCP_SERVER_URL (e.g., https://<cloudflared>.trycloudflare.com/mcp).');
        }

        const response: any = await openaiRef.current.responses.create({
          model: OPENAI_MODEL,
          input: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
          // The OpenAI SDK types may not yet include MCP tool typing; keep this demo-friendly.
          tools: [
            {
              type: 'mcp',
              server_label: REMOTE_MCP_SERVER_LABEL,
              server_description: 'Remote MCP server (tunneled for demo).',
              server_url: REMOTE_MCP_SERVER_URL,
              require_approval: 'never',
            },
          ] as any,
        });

        const assistantText = collectAssistantTextFromResponse(response) || '(No output)';
        setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }]);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
        setError(message);
      } finally {
        setIsLoading(false);
        sendInFlightRef.current = false;
      }
    },
    [enabled, messages]
  );

  return { messages, isLoading, error, sendMessage };
}
