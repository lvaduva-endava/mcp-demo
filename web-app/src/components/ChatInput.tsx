import { useState } from 'react';
import type { KeyboardEvent } from 'react';

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

const suggestions = [
  'Show me all available electric cars',
  'What Toyota vehicles do you have in stock?',
  'I want a quote for a BMW with 15% discount',
  'Tell me about your dealership'
];

export default function ChatInput({ onSend, disabled }: Props) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    setMessage(text);
    onSend(text);
    setMessage('');
  };

  return (
    <div className="input-area">
      <div className="suggestions">
        {suggestions.map((suggestion, index) => (
          <div 
            key={index}
            className="suggestion" 
            onClick={() => handleSuggestion(suggestion)}
          >
            {suggestion}
          </div>
        ))}
      </div>
      <div className="input-wrapper">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me about our cars..."
          disabled={disabled}
        />
        <button onClick={handleSend} disabled={disabled || !message.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
