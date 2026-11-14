import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, BookOpen, CheckCircle2, CircleHelp, Clock3, Database, FileText, Gauge, RefreshCw, ShieldCheck, Users, Wallet, Zap } from "lucide-react";

const API = "";
const tools = [
  { id: "get_my_accounts", label: "Fetch accounts", description: "Your two accounts, contacts, deals and deadlines" },
  { id: "get_data_format", label: "Fetch data schema", description: "Field definitions for accurate interpretation" },
  { id: "get_flytbase_team", label: "Fetch FlytBase team", description: "Internal owners and support contacts" },
  { id: "get_feature_requests", label: "Fetch feature requests", description: "Customer product requests" },
  { id: "get_release_notes", label: "Fetch release notes", description: "Product changes that may affect accounts" },
  { id: "get_signals", label: "Check live signals", description: "New events affecting your accounts" },
  { id: "whoami", label: "Check mission status", description: "What is currently open in the challenge" }
];

function pretty(value) {
  if (value === null || value === undefined || value === "") return "Not established";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}
function walk(value, path = "root", out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([k, v]) => {
      if (v && typeof v === "object") walk(v, `${path}.${k}`, out);
      else out.push({ key: k, value: v, path: `${path}.${k}` });
    });
  }
  return out;
}
function findAccounts(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const key of ["accounts", "data", "results", "customers"]) {
    if (Array.isArray(data[key])) return data[key];
    if (data[key] && typeof data[key] === "object") {
      const nested = findAccounts(data[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}
function accountName(a, i) {
  return a?.name || a?.account_name || a?.customer || a?.company || a?.id || `Account ${i + 1}`;
}
function collectDeals(account) {
  for (const k of ["deals", "opportunities", "pipeline"]) if (Array.isArray(account?.[k])) return account[k];
  return [];
}
function collectPeople(account) {
  for (const k of ["people", "contacts", "stakeholders", "participants"]) if (Array.isArray(account?.[k])) return account[k];
  return [];
}
function sourceText(obj) {
  const hits = walk(obj).filter(x => /source|file|record|evidence|id|path|citation/i.test(x.key)).slice(0, 12);
  return hits.length ? hits.map(x => `${x.key}: ${pretty(x.value)}`).join("\n") : "No explicit source reference found in this record.";
}
function Section({ icon: Icon, title, subtitle, children }) {
  return <section className="panel"><div className="section-head"><div className="section-icon"><Icon size={17}/></div><div><h3>{title}</h3><p>{subtitle}</p></div></div>{children}</section>;
}
function JsonBlock({ value }) {
  return <pre className="json">{pretty(value)}</pre>;
}
function AccountView({ account, index, store }) {
  const deals = collectDeals(account);
  const people = collectPeople(account);
  const paperwork = store.fetched[`get_all_paperwork:${accountName(account, index)}`]?.data;
  const accountData = store.fetched[`get_all_paperwork:${account?.id || accountName(account, index)}`]?.data;
  const evidence = paperwork || accountData;
  const accountFlat = walk(account);
  const money = accountFlat.filter(x => /value|amount|price|revenue|budget|worth|deal_size|currency/i.test(x.key));
  const deadlines = accountFlat.filter(x => /deadline|due|date|expiry|renew|tender|close/i.test(x.key));
  const blockers = accountFlat.filter(x => /blocker|risk|issue|stuck|obstacle|pending/i.test(x.key));
  return <div className="account-grid">
    <Section icon={Wallet} title="1. Book value" subtitle="Deals and amounts supported by account records">
      {deals.length ? deals.map((d, i) => <div className="record" key={i}><div className="record-title">{d.name || d.title || d.id || `Deal ${i+1}`}</div><div className="record-meta">{pretty(d.value ?? d.amount ?? d.price ?? d.deal_value ?? "Value not established")}</div><details><summary>Evidence / source fields</summary><JsonBlock value={d}/></details></div>) : <Empty text="No deal objects detected yet. Inspect the source data below; do not infer a deal value from an unsupported claim."/>}
      {money.length > 0 && <details className="subdetails"><summary>Other monetary fields ({money.length})</summary><JsonBlock value={money}/></details>}
    </Section>
    <Section icon={Users} title="2. Who holds the power?" subtitle="Decision-makers, payers, users and blockers">
      {people.length ? people.map((p, i) => <div className="person" key={i}><div className="avatar">{(p.name || p.full_name || "?").slice(0,1).toUpperCase()}</div><div><b>{p.name || p.full_name || p.title || `Contact ${i+1}`}</b><span>{p.role || p.title || p.position || "Role not established"}</span><small>{p.relationship || p.status || p.relationship_status || "Relationship status not established"}</small></div></div>) : <Empty text="No structured contacts detected. Check the full account record for stakeholders."/>}
    </Section>
    <Section icon={Zap} title="3. What do you do first?" subtitle="Prioritised next moves with owner, date and deal">
      <Empty text="Actions must be grounded in your journal, deadlines and blockers. Add verified next steps using the note form below; avoid invented owners or dates."/>
    </Section>
    <Section icon={AlertTriangle} title="4. What is about to go wrong?" subtitle="Deadlines, stalled deals and relationship risks">
      {deadlines.length || blockers.length ? <div className="signal-list">{[...deadlines, ...blockers].slice(0,12).map((x,i)=><div className="signal" key={i}><AlertTriangle size={14}/><div><b>{x.key}</b><span>{pretty(x.value)}</span><small>{x.path}</small></div></div>)}</div> : <Empty text="No explicit deadline or blocker fields detected. This is an information gap, not proof that there are no risks."/>}
    </Section>
    <Section icon={CircleHelp} title="5. What do you still not know?" subtitle="Missing facts and who can provide them">
      <div className="unknown-list">
        {["Verified value and source for every open deal","Named decision-maker and their current stance","Named payer / budget owner and approval route","Operational user and adoption evidence","Blocker owner, required evidence and deadline"].map((q,i)=><div className="unknown" key={i}><CircleHelp size={14}/><span>{q}</span></div>)}
      </div>
      <p className="hint">These are default verification checks. Replace or resolve them using actual account evidence.</p>
    </Section>
    <Section icon={Database} title="Account evidence" subtitle="Raw MCP data — inspect it before making claims">
      <details open><summary>Account record</summary><JsonBlock value={account}/></details>
      {evidence && <details><summary>Account paperwork</summary><JsonBlock value={evidence}/></details>}
    </Section>
  </div>;
}
function Empty({ text }) { return <div className="empty"><CircleHelp size={16}/><span>{text}</span></div>; }

export default function App() {
  const [store, setStore] = useState({ fetched: {}, notes: [] });
  const [health, setHealth] = useState({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteAccount, setNoteAccount] = useState("");
  const [noteKind, setNoteKind] = useState("next_step");
  const [tab, setTab] = useState("dashboard");

  async function refreshLocal() {
    const [s, h] = await Promise.all([fetch("/api/store").then(r=>r.json()), fetch("/api/health").then(r=>r.json())]);
    setStore(s); setHealth(h);
  }
  useEffect(() => { refreshLocal().catch(()=>{}); }, []);

  async function fetchTool(tool, args = {}) {
    setBusy(tool); setMessage("");
    try {
      const r = await fetch(`/api/fetch/${tool}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(args) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Request failed");
      setMessage(`${tool} fetched and stored successfully.`);
      await refreshLocal();
    } catch(e) { setMessage(e.message); }
    finally { setBusy(""); }
  }
  async function saveNote(e) {
    e.preventDefault(); setBusy("note"); setMessage("");
    try {
      const r = await fetch("/api/note", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({text:noteText, account:noteAccount || undefined, kind:noteKind}) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save note");
      setNoteText(""); setMessage("Note written back to Questathon."); await refreshLocal();
    } catch(e) { setMessage(e.message); }
    finally { setBusy(""); }
  }

  const accountsData = store.fetched?.get_my_accounts?.data;
  const accounts = useMemo(() => findAccounts(accountsData), [accountsData]);
  const fetchedCount = Object.keys(store.fetched || {}).length;
  const lastUpdated = store.updatedAt ? new Date(store.updatedAt).toLocaleString() : "Not yet connected";

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">F</div><div><b>FLYTBASE</b><span>Customer Success CRM</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className={tab==="dashboard"?"nav active":"nav"} onClick={()=>setTab("dashboard")}><Gauge size={17}/> Overview</button>
      <button className={tab==="connect"?"nav active":"nav"} onClick={()=>setTab("connect")}><Database size={17}/> MCP & data</button>
      <button className={tab==="notes"?"nav active":"nav"} onClick={()=>setTab("notes")}><FileText size={17}/> Notes & actions</button>
      <div className="sidebar-bottom"><ShieldCheck size={16}/><span>Token stays server-side</span></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">QUESTATHON / ACCOUNT INTELLIGENCE</div><h1>{tab==="dashboard"?"Customer portfolio":tab==="connect"?"Connect your live data":"Notes & next steps"}</h1></div><div className="top-status"><span className={health.tokenConfigured?"dot green":"dot"}/>{health.tokenConfigured?"Token configured":"Token not configured"}</div></header>
      {message && <div className={message.toLowerCase().includes("success")||message.toLowerCase().includes("written")?"toast success":"toast"}>{message}<button onClick={()=>setMessage("")}>×</button></div>}
      {tab==="dashboard" && <>
        <div className="hero"><div><div className="hero-tag"><Activity size={14}/> LIVE ACCOUNT WORKSPACE</div><h2>Know the account.<br/><em>Move the deal.</em></h2><p>One evidence-led view of deal value, stakeholders, priorities, risks and unknowns.</p></div><div className="hero-art"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="hero-core"><Activity size={32}/></div></div></div>
        <div className="stats">
          <div className="stat"><span>Accounts loaded</span><b>{accounts.length || "—"}</b><small>From get_my_accounts</small></div>
          <div className="stat"><span>Data sets stored</span><b>{fetchedCount}</b><small>Saved server-side</small></div>
          <div className="stat"><span>Last sync</span><b className="stat-date">{lastUpdated}</b><small>Latest successful MCP call</small></div>
          <div className="stat"><span>New signals</span><b>{store.fetched?.get_signals?"Fetched":"—"}</b><small>Check live events in MCP & data</small></div>
        </div>
        {!accounts.length ? <div className="empty-state"><div className="empty-icon"><Database size={25}/></div><h3>Your accounts will appear here</h3><p>Connect your private token, then fetch <code>get_my_accounts</code>. The dashboard will populate from the real Questathon data.</p><button className="primary" onClick={()=>setTab("connect")}>Connect MCP <ArrowUpRight size={16}/></button></div> :
          <>{accounts.map((a,i)=><div className="account-block" key={a.id || accountName(a,i)}><div className="account-title"><div><div className="eyebrow">ACCOUNT {String(i+1).padStart(2,"0")}</div><h2>{accountName(a,i)}</h2></div><span className="pill">Live source data</span></div><AccountView account={a} index={i} store={store}/></div>)}</>}
      </>}
      {tab==="connect" && <div className="connect-layout">
        <section className="panel connect-panel"><div className="section-head"><div className="section-icon"><ShieldCheck size={17}/></div><div><h3>Secure MCP connection</h3><p>Your token is read only by the backend.</p></div></div><div className="notice"><ShieldCheck size={17}/><span>Paste the token only into <b>server/.env</b>. Never put it in React, GitHub or this dashboard's browser.</span></div><div className="connection-line"><span className={health.tokenConfigured?"dot green":"dot"}/><b>{health.tokenConfigured?"Server token detected":"Waiting for token"}</b><small>{health.lastTool?`Last call: ${health.lastTool}`:"No MCP call yet"}</small></div><h4>Fetch and store your data</h4><p className="hint">The MCP allows one call per minute per token. Fetch one item, wait for the timer, then fetch the next. The responses are saved locally in server/store.json.</p><div className="tool-list">{tools.map(t=><div className="tool-row" key={t.id}><div><b>{t.label}</b><span>{t.description}</span><code>{t.id}</code></div><button className="secondary" disabled={!!busy || !health.tokenConfigured} onClick={()=>fetchTool(t.id)}>{busy===t.id?<RefreshCw className="spin" size={15}/>:"Fetch"}</button></div>)}</div></section>
        <section className="panel"><div className="section-head"><div className="section-icon"><Clock3 size={17}/></div><div><h3>Rate limit & stored data</h3><p>Respect the one-call-per-minute rule.</p></div></div><div className="big-number">{fetchedCount}<span> saved data sets</span></div><div className="stored-list">{Object.entries(store.fetched||{}).map(([k,v])=><div key={k}><CheckCircle2 size={14}/><span>{k}</span><small>{new Date(v.fetchedAt).toLocaleTimeString()}</small></div>)}</div><button className="secondary full" onClick={refreshLocal}>Refresh local store</button></section>
      </div>}
      {tab==="notes" && <div className="notes-layout"><section className="panel"><div className="section-head"><div className="section-icon"><FileText size={17}/></div><div><h3>Write a note back</h3><p>Save a verified next step, risk or account note to Questathon.</p></div></div><form onSubmit={saveNote} className="note-form"><label>Account identifier (optional)<input value={noteAccount} onChange={e=>setNoteAccount(e.target.value)} placeholder="Use the exact account name or ID"/></label><label>Note type<select value={noteKind} onChange={e=>setNoteKind(e.target.value)}><option value="next_step">Next step</option><option value="risk">Risk</option><option value="task">Task</option><option value="note">General note</option></select></label><label>Note<textarea required rows="5" value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Write a specific, evidence-backed action..."/></label><button className="primary" disabled={busy==="note" || !noteText.trim()}>{busy==="note"?"Saving...":"Write note to MCP"}</button></form></section><section className="panel"><h3>Locally recorded notes</h3>{store.notes?.length?store.notes.slice().reverse().map((n,i)=><div className="record" key={i}><b>{n.kind} {n.account?`· ${n.account}`:""}</b><p>{n.text}</p><small>{new Date(n.savedAt).toLocaleString()}</small></div>):<Empty text="No notes have been saved yet."/>}</section></div>}
      <footer><span>FLYTBASE CRM · QUESTATHON BUILD</span><span>Evidence first · No invented numbers</span></footer>
    </main>
  </div>;
}