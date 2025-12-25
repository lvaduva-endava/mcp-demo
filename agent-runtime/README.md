# agent-runtime

A minimal Node.js "agent runtime" server that:
- connects to the local MCP server over Streamable HTTP
- runs an OpenAI Agent that auto-discovers MCP tools
- exposes a simple JSON chat endpoint for the React app

## Setup

```bash
npm install
```

## Run

```bash
# Dev
OPENAI_API_KEY=... npm run dev

# Or point at MCP explicitly (defaults to http://localhost:4000/mcp)
OPENAI_API_KEY=... MCP_SERVER_URL=http://localhost:4000/mcp npm run dev
```

Server:
- `POST http://localhost:8787/chat`

Body:
```json
{ "sessionId": "optional", "message": "hello" }
```

Response:
- JSON: `{ "sessionId": "...", "assistant": { "role": "assistant", "content": "..." } }`
