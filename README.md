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

The server provides a REST API for configuration management:

```bash
# Configuration
GET  /api/config           # Get current configuration
PUT  /api/config           # Save complete configuration
GET  /api/config/check     # Check for changes (polling)

# Backups
GET  /api/backups                      # List available backups
POST /api/backups                      # Create manual backup
POST /api/backups/restore/:filename    # Restore from backup
DELETE /api/backups/:filename          # Delete backup

# Image uploads
POST /api/upload-icon      # Upload image file for icons
GET  /uploads/:filename    # Serve uploaded images
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
