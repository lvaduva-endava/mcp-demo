# Setup (MCP Server + Dealer Chat)

## Prereqs
- Node.js + npm
- Two folders on disk:
  - MCP server: this repo
  - UI client: `dealer-chat` repo (in this workspace it is at `/Users/llucixxeu/git/dealer-chat/dealer-chat`)

## 1) Start the MCP server
From this repo:

```bash
npm install
npm run dev
```

Expected:
- Server prints something like: `... running at http://localhost:4000/mcp`
- `GET http://localhost:4000/mcp` returns `{ ok: true, ... }`

## 2) Start dealer-chat
From the dealer-chat repo:

```bash
npm install
npm run dev
```

Configure `.env` in the dealer-chat repo:
- `VITE_MCP_SERVER_URL` should match the MCP server endpoint.
- The UI code currently expects `VITE_OPENAI_API_KEY`.

Expected:
- Vite prints a local URL (commonly `http://localhost:5173`).

## 3) (Optional) MCP Inspector
From this MCP server repo:

```bash
npm run mcp
```

Use it to explore:
- Tools list + schemas
- Resources list
- Prompts list

## Notes for presenters
- For deterministic demos, avoid ambiguous requests. Prefer “car c1” / “discount 10%”.
- If your demo modifies data (`create_order`), you may want to reset `src/data/orders.json` and car statuses before the talk.
