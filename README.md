# MCP Introduction — Pass-it-on Demo Workspace

This repo is a training/demo workspace for introducing **Model Context Protocol (MCP)** using a concrete scenario: a **car dealership** chat assistant that can browse inventory, generate quotations, and create orders via **typed MCP tools/resources/prompts**.

It contains three small apps that you can run locally:
- `mcp-server/`: the MCP server (tools/resources/prompts + JSON persistence)
- `web-app/`: a React chat UI (demo client)
- `agent-runtime/`: an optional Node “agent runtime” (keeps OpenAI keys server-side)

## Quickstart (demo mode: local MCP + browser OpenAI key)

### Prereqs
- Node.js + npm
- An OpenAI API key (for workshop/demo use)

### 1) Start the MCP server

```bash
cd mcp-server
npm install
npm run dev
```

- MCP endpoint (dev): `http://localhost:4000/mcp`

### 2) Configure and start the web app

Create `web-app/.env.local`:

```env
VITE_MCP_SERVER_URL=http://localhost:4000/mcp
VITE_OPENAI_API_KEY=sk-your-key-here
```

Run the UI:

```bash
cd web-app
npm install
npm run dev
```

Open the Vite URL (typically `http://localhost:5173`).

## Remote MCP mode (make localhost publicly reachable via Cloudflare Tunnel)

Some demos are easier if OpenAI can reach your MCP server over a **public HTTPS URL**. A quick way to do this for a workshop is Cloudflare Tunnel.

### 0) Install `cloudflared` (macOS)

```bash
brew install cloudflare/cloudflare/cloudflared
```

### 1) Start the MCP server locally

```bash
cd mcp-server
npm run dev
```

Expected local endpoint: `http://localhost:4000/mcp`.

### 2) Create a public URL that forwards to localhost

In a separate terminal:

```bash
cloudflared tunnel --url http://localhost:4000
```

`cloudflared` will print a public URL like `https://<random>.trycloudflare.com`.

Your public MCP endpoint is:

`https://<random>.trycloudflare.com/mcp`

### 3) Update web-app env vars for Remote MCP

Set these in `web-app/.env.local`:

```env
# Still required (browser calls OpenAI)
VITE_OPENAI_API_KEY=sk-your-key-here

# Used by the “Remote MCP” chat mode
VITE_REMOTE_MCP_SERVER_URL=https://<random>.trycloudflare.com/mcp
VITE_REMOTE_MCP_SERVER_LABEL=dealer-mcp
```

Then switch the UI to the “Remote MCP” mode (the mode selector lives in `web-app/src/App.tsx`).

### Safety note
This exposes your local demo server to the internet. Use only for workshop/demo data, and shut down the tunnel when finished.

## What to demo (5–8 minutes)

A deterministic live flow you can follow:
1. “Show me all available electric cars.” → expects MCP tool `check_car_configuration`
2. “Give me a quote for car c1 with 10% discount.” → expects `generate_quotation`
3. “Create an order for car c1, customer Maria Ionescu, agreed price 21150.” → expects `create_order`
4. “List all orders.” → expects `list_orders`
5. “Draft a short sales email for Alex Popescu about car c2 with 7% discount.” → prompt-driven email drafting

See the canonical run sheet: `mcp-server/docs/mcp-demo/06-end-to-end-script.md`.

## Repo layout

### mcp-server/
A **pure MCP server** exposed over Streamable HTTP at `/mcp`.

- Dev URL: `http://localhost:4000/mcp` (because `npm run dev` sets `PORT=4000`)
- Production URL: `http://localhost:${PORT:-3000}/mcp` (when using `npm start`)

Contract surface:
- **Tools**: inventory search/listing, quotation, order creation, list orders
- **Resources**: dealership info (`dealer://info`), car detail URIs (`car://{carId}`)
- **Prompts**: `sales-quotation`

Data persistence:
- `mcp-server/src/data/cars.json`
- `mcp-server/src/data/orders.json`

### web-app/
A React + Vite chat UI with multiple integration modes (mode selector is in `web-app/src/App.tsx`).

For this session’s default demo mode, the browser:
- calls OpenAI directly using `VITE_OPENAI_API_KEY`
- connects to the MCP server at `VITE_MCP_SERVER_URL`

### agent-runtime/ (optional)
A small Express server that:
- keeps `OPENAI_API_KEY` server-side
- connects to the MCP server via Streamable HTTP
- exposes `POST /chat` for the UI

Run it if you want to avoid putting an API key in the browser:

```bash
cd agent-runtime
npm install
OPENAI_API_KEY=sk-your-key-here npm run dev
```

Default URL: `http://localhost:8787`

## Troubleshooting (common)

- **Port mismatch**: `mcp-server` dev uses 4000 by script. If your client points to `http://localhost:3000/mcp`, update it (or run `PORT=3000 npm run dev`).
- **“OPENAI_API_KEY not set” in the UI**: for browser mode, set `VITE_OPENAI_API_KEY` in `web-app/.env.local`.
- **Reset demo state**:
  - set `mcp-server/src/data/orders.json` to `[]`
  - reset sold cars in `mcp-server/src/data/cars.json` back to `"available"`

- **Remote MCP can’t connect**: ensure you set `VITE_REMOTE_MCP_SERVER_URL` to the public URL **including** `/mcp`, and that the tunnel is still running.

More notes: `mcp-server/docs/mcp-demo/90-troubleshooting.md`.

## Notes

- This workspace is intentionally demo-oriented. Some docs may mention older names like “dealer-chat”; in this repo the UI is `web-app/`.
- For an architecture overview and the 3-app flow diagram, see `_docs/MCP_APP_FLOWS.md` and `_docs/NEW_CHAT_CONTEXT.md`.
