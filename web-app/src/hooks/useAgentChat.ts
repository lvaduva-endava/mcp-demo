import { useCallback, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

const AGENT_RUNTIME_URL = import.meta.env.VITE_AGENT_RUNTIME_URL || 'http://localhost:8787';

export function useAgentChat(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm your AI car dealership assistant." },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!enabled) {
        setError('Agent chat is disabled. Switch modes or enable it.');
        return;
      }

      setIsLoading(true);
      setError(null);

      // optimistic: add user message immediately
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

      try {
        const resp = await fetch(`${AGENT_RUNTIME_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            message: userMessage,
          }),
        });

        const payload = await resp.json().catch(() => null);
        if (!resp.ok) {
          const err = payload?.error ? String(payload.error) : `Agent runtime error: HTTP ${resp.status}`;
          throw new Error(err);
        }

        if (payload?.sessionId) sessionIdRef.current = String(payload.sessionId);
        const assistantContent = payload?.assistant?.content;
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: assistantContent ? String(assistantContent) : '(No output)' },
        ]);

        setIsLoading(false);
      } catch (e: unknown) {
        setIsLoading(false);
        const message =
          e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
        setError(message);
      }
    },
    [enabled]
  );

  return { messages, isLoading, error, sendMessage };
}
