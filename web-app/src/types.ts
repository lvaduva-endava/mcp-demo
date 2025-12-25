// Types for chat messages
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
