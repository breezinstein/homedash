# 🏠 Homedash

A modern, responsive dashboard for managing homelab services built with React, TypeScript, and Tailwind CSS.

## Features

### 🎯 Core Features
- **Service Management**: Add, edit, and organize your homelab services
- **Category Groups**: Collapsible sections to organize services by type
- **Icon Support**: Lucide icons, custom image URLs, and **image uploads**
- **Search**: Real-time filtering with keyboard shortcuts (Ctrl+K)
- **Multi-Clipboard**: Save labeled snippets server-side and copy any of
  them with one click — synced across all your devices (Ctrl+Shift+C)
- **Server Stats**: Live CPU, memory, disk, uptime, and system info for the
  host machine HomeDash runs on — plus any other servers you add. Remote
  servers run [Glances](https://nicolargo.github.io/glances/) (web server on
  port 61208); HomeDash reads their REST API (v4 with automatic v3 fallback) to
  show metrics **and the Docker containers** running on each host, all from one
  panel. Password-protected Glances instances are supported via optional
  username/password (HTTP Basic auth)
- **Notifications**: Subscribe to a self-hosted
  [ntfy](https://ntfy.sh/) server and receive push notifications from your
  other services directly in the dashboard. The subscription runs
  **server-side**: HomeDash holds a single connection to ntfy, captures
  messages even when no browser tab is open, and streams them to the dashboard
  over same-origin Server-Sent Events — so ntfy credentials never reach the
  browser. A header bell shows an unread count and opens a live panel with
  priority colours, tags, click-through links, action buttons, and attachment
  previews. Optional desktop notifications fire when the tab is in the
  background. Configure the server URL, topics, and optional Basic-auth
  credentials under **Settings → Notifications**. _Note: ntfy credentials are
  stored in `data/config.json` in plain text (consistent with remote server
  credentials), so protect that file accordingly._
- **Responsive Design**: Works great on desktop, tablet, and mobile

### ⚙️ Configuration
- **Server-side Storage**: Persistent configuration with automatic sync
- **JSON Import/Export**: Backup and restore configurations
- **Grid Layout**: Adjustable columns (2-6) to fit your screen
- **Custom Themes**: Customize colors and appearance

### 📱 User Experience
- **Dark Theme**: Modern dark theme with customizable accents
- **Smooth Animations**: CSS transitions and hover effects
- **Touch Optimized**: Great mobile and tablet experience
- **Keyboard Shortcuts**: Quick navigation and search
- **Image Upload**: Upload custom icons/logos with automatic management

### 🔐 Authentication (optional)

HomeDash supports a **single-admin password** so destructive and sensitive
surfaces aren't exposed to anyone on the LAN. Auth is opt-in: when no
credential env var is set the server runs in open mode (identical to
pre-auth releases) and a startup log line makes the mode explicit.

| Env var | Purpose |
|---|---|
| `HOMEDASH_ADMIN_PASSWORD` | Plaintext admin password. Easiest to set, but lives in your compose file. |
| `HOMEDASH_ADMIN_PASSWORD_HASH` | Prefer this. Format `scrypt:<saltHex>:<derivedKeyHex>` — see compose example for a one-liner that generates it. Takes precedence over the plaintext form. |
| `HOMEDASH_SESSION_SECRET` | HMAC key signing session cookies. If unset, a per-process random value is used (sessions invalidate on every restart). Set this to a stable random value to survive restarts. |
| `HOMEDASH_SESSION_TTL_HOURS` | Session lifetime. Default `720` (30 days). |
| `HOMEDASH_AUTH_DISABLED` | Dev escape hatch; explicitly disable auth even when a password is set. Honoured only outside production. |

What's gated when auth is enabled:

- **Anonymous viewers** still see the launcher (services, categories, theme,
  custom CSS, search) — the public config payload is a **redacted projection**
  that omits secrets (notifications credentials, remote-server credentials,
  clipboard snippets).
- **Notification badge** is visible to everyone: the header bell polls a
  public `GET /api/notifications/count` endpoint every 20 s and shows the
  unread tally. Message content (titles, bodies, links, the full panel)
  still requires sign-in — clicking the bell anonymously opens the login
  modal.
- **Admin actions** (Settings, Edit mode, Backups, Server Stats, Clipboard,
  Notifications panel, File Sharing, all writes, icon proxy, ntfy config) all
  require sign-in.
- A "View only" badge in the header tells anonymous viewers they're in read
  mode and offers a Sign in button.
- A 401 from any admin action automatically opens the login modal.

Login brute-force is throttled in-process: 5 failed attempts per IP per 15
minutes returns 429 with a `Retry-After` header.

Cookies are HttpOnly, SameSite=Lax, and `Secure` when the request arrives
over HTTPS (works behind a reverse proxy via `X-Forwarded-Proto`). CSRF
defence relies on SameSite plus a custom `X-Requested-With: HomeDash` header
on state-changing requests; the frontend sets it automatically.

> **Note:** the admin password is the only credential that protects the
> dashboard. Store it via your container secrets manager rather than
> committing it.

> **Phase 3 (implemented):** File sharing splits into a public area
> (`SHARED_PUBLIC_DIR`, default `${SHARED_FILES_DIR}/public`, readable
> anonymously) and a private area (`SHARED_PRIVATE_DIR`, default
> `${SHARED_FILES_DIR}/private`, admin only). Admins can **publish** items
> from private→public (creating a share link at
> `<origin>/api/files/public/<filename>`) and **unpublish** them back. A
> one-shot migration on first boot moves any legacy `shared-files/` contents
> into `private/` so existing deployments don't lose data.

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/breezinstein/homedash.git
cd homedash

# Build and start with Docker Compose
docker compose up -d --build

# Access dashboard at http://localhost:3001
```

### Option 2: Pre-built Docker Image

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/breezinstein/homedash:latest

# Run the container
docker run -d \
  --name homedash \
  -p 3001:3001 \
  -v homedash-data:/app/data \
  --restart unless-stopped \
  ghcr.io/breezinstein/homedash:latest
```

### Option 3: Development Mode

```bash
# Install dependencies
npm install

# Start development server (frontend + backend)
npm run dev

# Frontend: http://localhost:5173
# Backend API: http://localhost:3001
```

### Option 4: Production Build

```bash
# Install dependencies
npm install

# Build the frontend
npm run build

# Start the server
npm run server

# Access at http://localhost:3001
```

## Docker Deployment

### Docker Compose (Recommended)

The included `docker-compose.yml` builds and runs from source:

```bash
# Build and start the container
docker compose up -d --build

# Access dashboard at http://localhost:3001
```

### Pre-built Image from GitHub Container Registry

Alternatively, use the pre-built image without cloning the repository:

```yaml
# docker-compose.yml
services:
  homedash:
    image: ghcr.io/breezinstein/homedash:latest
    container_name: homedash
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - homedash-data:/app/data
    environment:
      - NODE_ENV=production

volumes:
  homedash-data:
    driver: local
```

```bash
docker compose up -d
```

### Manual Docker Run

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/breezinstein/homedash:latest

# Run the container
docker run -d \
  --name homedash \
  -p 3001:3001 \
  -v homedash-data:/app/data \
  --restart unless-stopped \
  ghcr.io/breezinstein/homedash:latest
```

### Manual Build

```bash
# Build for current architecture
docker build -t homedash .

# Run the container
docker run -d \
  --name homedash \
  -p 3001:3001 \
  -v homedash-data:/app/data \
  homedash

# Build for multiple architectures (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64 -t homedash .
```

### Available Platforms
- `linux/amd64` - Standard x86_64 systems
- `linux/arm64` - ARM64 systems (Raspberry Pi 4+, Apple Silicon, etc.)

## API Reference

The server provides a REST API for configuration management. When auth is
enabled, only the endpoints marked **public** are reachable without a session
cookie; everything else returns 401.

```bash
# Configuration
GET  /api/config           # Current config (public — anonymous receives a redacted projection)
PUT  /api/config           # Save complete configuration (admin)
GET  /api/config/check     # Check for changes (public, polling)

# Authentication
GET  /api/auth/status      # { authEnabled, authenticated } (public)
POST /api/auth/login       # { password } -> 204 + cookie (public)
POST /api/auth/logout      # Clear session cookie (public)

# Server stats
GET  /api/stats            # Live host metrics (admin)
GET  /api/stats/remote?url=<glancesBase>  # Proxy + normalize stats from Glances (admin)

# Backups
GET  /api/backups                      # List backups (admin)
POST /api/backups                      # Create manual backup (admin)
POST /api/backups/restore/:filename    # Restore from backup (admin)
DELETE /api/backups/:filename          # Delete backup (admin)

# Image uploads
POST /api/upload-icon      # Upload image file for icons (admin)
GET  /uploads/:filename    # Serve uploaded images (public)

# Notifications
GET  /api/notifications/count          # { unread, connected, lastMessageAt } (public — bell badge)
GET  /api/notifications                # Full message history (admin)
GET  /api/notifications/stream         # SSE: live messages + status (admin)
POST /api/notifications/dismiss        # Dismiss one / topic / all (admin)
POST /api/notifications/test           # Server-side ntfy connectivity probe (admin)

# File sharing (Phase 3)
GET    /api/files/public{/*path}       # List / download from the public area (public)
GET    /api/files/private{/*path}      # List / download from the private area (admin)
PUT    /api/files/{public|private}{/*path}    # Upload (admin both scopes)
DELETE /api/files/{public|private}{/*path}    # Delete (admin both scopes)
POST   /api/files/move                 # Publish/unpublish: { from:{scope,path}, to:{scope,path}, overwrite? } (admin)
# Legacy /api/files/* returns 410 Gone with a pointer to the new paths.
```

## Configuration Format

The dashboard uses a JSON format for configuration:

```json
{
  "services": [
    {
      "name": "Service Name",
      "url": "http://service.local:port",
      "icon": "server",
      "category": "Category Name",
      "description": "Service description"
    }
  ],
  "collapsedCategories": [],
  "gridColumns": "4",
  "theme": "dark",
  "colors": {
    "primary": "#6366f1",
    "background": "#0a0a0a",
    "surface": "#1a1a1a"
  },
  "categoryOrder": [],
  "clips": [
    {
      "id": "ssh-pi",
      "label": "SSH to Pi",
      "content": "ssh pi@homelab.local",
      "pinned": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4
- **Backend**: Express 5, Node.js
- **Icons**: Lucide React
- **Build**: Vite
- **Container**: Docker with multi-arch support

## Development

### Project Structure

```
homedash/
├── src/
│   ├── components/     # React components
│   ├── context/        # React context providers
│   ├── api/            # API client
│   ├── App.tsx         # Main application
│   └── types.ts        # TypeScript types
├── data/
│   ├── config.json     # Configuration file
│   ├── backups/        # Backup files
│   └── uploads/        # Uploaded images
├── server.js           # Express backend
├── docker-compose.yml  # Docker Compose config
└── Dockerfile          # Docker build config
```

### Scripts

```bash
npm run dev      # Start development (frontend + backend)
npm run client   # Start frontend only
npm run server   # Start backend only
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - Feel free to use and modify for your homelab!
