# Real-Time Notifications System

NovaFund uses a **real-time notification system** so users see milestone approvals, contribution confirmations, and project updates immediately.

## Features

- **Real-time updates** via Server-Sent Events (SSE) by default; optional WebSocket server for strict WebSocket support
- **Notification center** in the header (bell icon) with history and “mark all read”
- **Customizable preferences** (per-type toggles, browser push when tab is in background, sound)
- **Live toast** when a new notification arrives (dismissible, respects preferences)
- **Offline handling**: reconnects with backoff; history API for catch-up
- **Performance**: latest 50 shown in UI, 100 kept in memory; no degradation with many notifications

## How It Works

1. **Transport**: The client opens an SSE connection to `GET /api/notifications/stream`. The server sends existing history, then pushes new notifications as they occur.
2. **Emit**: Any part of the app (or backend) can send `POST /api/notifications/emit` with `{ type, title, message, link? }` to create and broadcast a notification.
3. **History**: `GET /api/notifications/history?limit=50` returns recent notifications (e.g. for offline catch-up).

## Notification Types

- `milestone_approval`
- `contribution_confirmation`
- `project_status`
- `project_update`
- `system`

Preferences (stored in `localStorage`) control which types are shown and whether browser push and sound are enabled.

## Optional WebSocket Server

For a **WebSocket-based** setup (e.g. requirement or preference), run the optional WS server alongside Next.js:

```bash
# Install dependencies (ws is in devDependencies)
npm install

# Terminal 1: Next.js
npm run dev

# Terminal 2: WebSocket notification server (port 3001)
npm run notifications:ws
```

The script exposes:

- **WebSocket** `ws://localhost:3001` – connect to receive live notifications (same JSON shape as SSE)
- **POST** `http://localhost:3001/emit` – body `{ type, title, message, link? }` to broadcast
- **GET** `http://localhost:3001/history?limit=50` – recent notifications

To use the WebSocket server from the frontend, point the client at it (e.g. via `NEXT_PUBLIC_WS_URL`) and add a WebSocket path in the notification context; the current default is SSE so the app works with only `next dev`.

## Validation Checklist

- Notifications arrive in real time (SSE or WS)
- Disconnections: client reconnects with exponential backoff; UI shows “Reconnecting…”
- UI: non-intrusive toast; center is intuitive with history and preferences
- Performance: list capped (e.g. 50 visible, 100 in memory); no heavy re-renders
