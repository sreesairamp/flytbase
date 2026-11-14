import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3001;
const MCP = "https://questathon.aihackerscollective.com/api/public/mcp";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(__dirname, "store.json");
let lastCallAt = 0;
let lastTool = null;

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE, "utf8")); }
  catch { return { fetched: {}, notes: [], updatedAt: null }; }
}
function writeStore(data) {
  fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
}
function unwrap(result) {
  const text = result?.result?.content?.find(x => x.type === "text")?.text;
  if (text) {
    try { return JSON.parse(text); } catch { return { text }; }
  }
  if (result?.result) return result.result;
  return result;
}

async function callMcp(name, args = {}) {
  if (!process.env.AQ_TOKEN || process.env.AQ_TOKEN === "PASTE_YOUR_TOKEN_HERE") {
    const error = new Error("Add your Questathon token to server/.env first.");
    error.status = 400;
    throw error;
  }
  const wait = 60000 - (Date.now() - lastCallAt);
  if (lastCallAt && wait > 0) {
    const error = new Error(`MCP rate limit: wait ${Math.ceil(wait / 1000)} seconds before the next call. Last call: ${lastTool}.`);
    error.status = 429;
    throw error;
  }
  const response = await fetch(MCP, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
      "authorization": `Bearer ${process.env.AQ_TOKEN}`
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args }
    })
  });
  const payload = await response.json();
  lastCallAt = Date.now();
  lastTool = name;
  if (!response.ok || payload.error || payload.result?.isError) {
    throw new Error(payload.error?.message || payload.result?.content?.[0]?.text || `MCP request failed (${response.status})`);
  }
  return unwrap(payload);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, tokenConfigured: Boolean(process.env.AQ_TOKEN && process.env.AQ_TOKEN !== "PASTE_YOUR_TOKEN_HERE"), lastCallAt, lastTool });
});

app.get("/api/store", (_req, res) => res.json(readStore()));

app.post("/api/fetch/:tool", async (req, res) => {
  const allowed = new Set([
    "whoami", "get_my_accounts", "get_data_format", "get_flytbase_team",
    "get_feature_requests", "get_release_notes", "get_signals",
    "list_paperwork", "get_all_paperwork"
  ]);
  const tool = req.params.tool;
  if (!allowed.has(tool)) return res.status(400).json({ error: "Tool not allowed." });
  try {
    const data = await callMcp(tool, req.body || {});
    const store = readStore();
    store.fetched[tool + (req.body?.account ? ":" + req.body.account : "")] = {
      data, fetchedAt: new Date().toISOString(), args: req.body || {}
    };
    store.updatedAt = new Date().toISOString();
    writeStore(store);
    res.json({ ok: true, tool, data, fetchedAt: store.updatedAt });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post("/api/note", async (req, res) => {
  const { text, account, kind = "next_step", title } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: "Note text is required." });
  try {
    const data = await callMcp("write_note", { text, ...(account ? { account } : {}), kind, ...(title ? { title } : {}) });
    const store = readStore();
    store.notes.push({ text, account: account || null, kind, title: title || null, savedAt: new Date().toISOString(), response: data });
    store.updatedAt = new Date().toISOString();
    writeStore(store);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

const clientDist = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
} else {
  app.get("/", (_req, res) => res.send("FlytBase CRM API is running. Start the Vite client on port 5173."));
}

app.listen(PORT, () => console.log(`CRM server listening on http://localhost:${PORT}`));