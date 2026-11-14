# FlytBase Live CRM — Questathon

An evidence-led Customer Success CRM for the two Questathon accounts. React/Vite frontend, Express backend, and server-side MCP access.

## Requirements
- Node.js 18 or newer
- Your private Questathon MCP token

## Run locally
1. Extract this repository.
2. In the project root run:
   ```bash
   npm install
   npm run install:all
   ```
3. Copy `server/.env.example` to `server/.env`.
4. Put your token in `server/.env`:
   ```env
   AQ_TOKEN=your_private_token
   PORT=3001
   ```
5. Start both apps:
   ```bash
   npm run dev
   ```
6. Open http://localhost:5173

## MCP rate limit
The Questathon MCP allows one call per minute per token. Use the MCP & data page to fetch one tool at a time. Successful responses are stored in `server/store.json`. Do not repeatedly fetch the same data.

## Security
- The MCP token is read only by the Express server.
- Never commit `server/.env` or `server/store.json`.
- Never expose the token in browser code, screenshots, recordings or public repository.
- Rotate the token if it is accidentally exposed.

## Current implementation notes
- The app fetches account data, schema, team, feature requests, release notes, signals and mission status through the MCP.
- It provides a generic evidence inspector so the account payload can be reviewed without fabricating facts.
- Account-specific CRM summaries should be refined against the actual schema and paperwork. Unknowns are explicitly shown rather than guessed.
- Notes are sent back through `write_note`.
- The MCP call throttle is in-memory and resets if the server restarts; avoid restarting repeatedly during the one-call-per-minute window.
"# flytbase" 
