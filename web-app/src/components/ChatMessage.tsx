import ReactMarkdown from 'react-markdown';
import type { ChatMessage as ChatMessageType } from "../types";

interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
  return (
    <div className={`message ${message.role}`}>
      {message.role === "assistant" ? (
        <div className="message-bubble">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      ) : (
        <div className="message-bubble">{message.content}</div>
      )}
    </div>
  );
}
