import { useEffect, useMemo, useRef, useState } from "react";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import TypingIndicator from "./components/TypingIndicator";
import { useChat } from "./hooks/useChat";
import { useAgentChat } from "./hooks/useAgentChat";
import { useChatRemoteMCP } from "./hooks/useChatRemoteMCP";
import "./App.css";

function App() {
  const [mode, setMode] = useState<"local" | "agent" | "remote-mcp">("remote-mcp");

  const localChat = useChat({ enabled: mode === "local" });
  const agentChat = useAgentChat({ enabled: mode === "agent" });
  const remoteMcpChat = useChatRemoteMCP({ enabled: mode === "remote-mcp" });

  const activeChat = useMemo(() => {
    if (mode === "local") return localChat;
    if (mode === "remote-mcp") return remoteMcpChat;
    return agentChat;
  }, [agentChat, localChat, mode, remoteMcpChat]);

  const { messages, isLoading, error, sendMessage } = activeChat;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-row">
          <h1>Car Dealership AI Assistant</h1>
          <div className="chat-mode-toggle">
            <button
              type="button"
              className={mode === "local" ? "active" : ""}
              onClick={() => setMode("local")}
              disabled={isLoading}
              aria-pressed={mode === "local"}
            >
              Local LLM (manual tools)
            </button>
            <button
              type="button"
              className={mode === "remote-mcp" ? "active" : ""}
              onClick={() => setMode("remote-mcp")}
              disabled={isLoading}
              aria-pressed={mode === "remote-mcp"}
            >
              Local LLM (remote MCP)
            </button>
            <button
              type="button"
              className={mode === "agent" ? "active" : ""}
              onClick={() => setMode("agent")}
              disabled={isLoading}
              aria-pressed={mode === "agent"}
            >
              Agent Runtime (process)
            </button>
          </div>
        </div>
        <p>
          Ask me anything about our car inventory, pricing, or place an order
        </p>
      </div>

      <div className="messages">
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        {isLoading && <TypingIndicator />}
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}

export default App;
