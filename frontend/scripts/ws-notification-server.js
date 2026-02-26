/**
 * Optional WebSocket notification server. Run alongside Next.js for true WebSocket support.
 * Usage: node scripts/ws-notification-server.js
 * Set NEXT_PUBLIC_WS_URL=http://localhost:3001 in .env.local and use this server for WS transport.
 *
 * Same origin: run Next.js on 3000 and this on 3001; configure CORS if needed for API calls.
 */

const http = require("http");
const WebSocket = require("ws");

const PORT = Number(process.env.WS_PORT) || 3001;
const MAX_HISTORY = 100;

const history = [];
const clients = new Set();

function addNotification(payload) {
  const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const item = {
    id,
    type: payload.type || "system",
    title: String(payload.title || "").slice(0, 200),
    message: String(payload.message || "").slice(0, 1000),
    link: payload.link,
    createdAt: new Date().toISOString(),
    read: false,
  };
  history.push(item);
  if (history.length > MAX_HISTORY) history.shift();
  const data = JSON.stringify(item);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
      } catch (err) {
        clients.delete(ws);
      }
    }
  });
  return item;
}

function getHistory(limit = 50) {
  return [...history].reverse().slice(0, limit);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/history") {
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getHistory(limit)));
    return;
  }

  if (req.method === "POST" && url.pathname === "/emit") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const notification = addNotification(payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(notification));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  clients.add(ws);
  const recent = getHistory();
  recent.forEach((n) => {
    try {
      ws.send(JSON.stringify(n));
    } catch {
      clients.delete(ws);
    }
  });
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

server.listen(PORT, () => {
  console.log(`WebSocket notification server listening on http://localhost:${PORT}`);
  console.log(`  WS endpoint: ws://localhost:${PORT}`);
  console.log(`  POST /emit  - emit notification`);
  console.log(`  GET /history?limit=50 - get history`);
});
