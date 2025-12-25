# Troubleshooting

## Dealer-chat shows “OPENAI_API_KEY not set”
- The dealer-chat code expects `VITE_OPENAI_API_KEY`.
- Ensure the dealer-chat `.env` includes it.

## Dealer-chat README/.env mentions Anthropic
- The dealer-chat docs currently refer to Anthropic/Claude, but the code uses OpenAI.
- Plan: align docs to reduce confusion (Milestone 2).

## MCP server port mismatch
- `npm run dev` in the MCP repo sets `PORT=4000` in package.json.
  - If your client points to `http://localhost:3000/mcp`, update it to `http://localhost:4000/mcp` (or run the server with `PORT=3000 npm run dev`).

## “Tell me about your dealership” doesn’t work in the chat UI
- Dealership info is exposed as a **resource** (`dealer://info`), not a tool.
- The current UI only provides MCP tools to the LLM.
- Use Inspector for now, or implement the client bridge function (Milestone 3).

## Create order worked but I want to reset the data
- Reset `src/data/orders.json` to an empty array `[]`.
- Reset any sold cars in `src/data/cars.json` back to `"available"`.
