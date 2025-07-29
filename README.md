# 🏠 Homelab Dashboard

A modern, responsive dashboard for managing homelab services with a clean and intuitive interface.

## Features

### 🎯 Core Features
- **Service Management**: Add, edit, and organize your homelab services
- **Category Groups**: Collapsible sections to organize services by type
- **Icon Support**: FontAwesome, Material Icons, and custom image URLs
- **Search**: Real-time filtering with keyboard shortcuts (Ctrl+K)
- **Responsive Design**: Works great on desktop, tablet, and mobile

### ⚙️ Configuration
- **Local Storage**: Automatic persistence of all settings
- **JSON Import/Export**: Backup and restore configurations
- **Grid Layout**: Adjustable columns (2-6) to fit your screen
- **Right-click Context Menu**: Easy editing and management

### 📱 User Experience
- **Dark Theme**: Modern dark theme with blue accents
- **Smooth Animations**: CSS-only transitions and hover effects
- **Touch Optimized**: Great mobile and tablet experience
- **Keyboard Shortcuts**: Quick navigation and search

## Quick Start

### Option 1: Client-Only Mode (Static Files)
1. **Open the dashboard**: Simply open `index.html` in any modern web browser
2. **Add services**: Click "Add Service" to add your homelab services
3. **Organize**: Create categories and organize your services
4. **Customize**: Adjust grid columns and export your configuration

### Option 2: Server Mode (Multi-Device Sync)
1. **Install dependencies**: `cd server && npm install`
2. **Start the server**: `npm start`
3. **Access dashboard**: Open `http://localhost:3001` in your browser
4. **Enjoy sync**: Your configuration automatically syncs across all devices

## 🌐 Server-Side Storage

Homedash supports **hybrid storage** with automatic fallback between server and local storage:

### Features
- **🔄 Multi-Device Sync**: Configuration syncs across all your devices
- **📱 Hybrid Mode**: Automatically detects server availability
- **💾 Local Backup**: Always maintains localStorage backup
- **🔒 Secure**: Rate-limited API with security headers
- **📊 Backup System**: Automatic configuration backups
- **⚡ Real-time Status**: Live sync status indicator

### Server API
The server provides a REST API for configuration management:

```bash
# Health check
GET /api/health

# Configuration management
GET /api/config           # Get current configuration
POST /api/config          # Save complete configuration

# Service management
GET /api/services         # List all services
POST /api/services        # Add new service
PUT /api/services/:name   # Update existing service
DELETE /api/services/:name # Delete service

# Backup management
GET /api/backups          # List available backups
GET /api/backups/:file    # Download backup file
POST /api/backup          # Create manual backup

# Settings
PATCH /api/settings       # Update settings only
```

### Docker Deployment

```bash
# Using Docker Compose (recommended)
docker-compose up -d

# Or build manually
docker build -t homedash .
docker run -p 3001:3001 -v homedash-data:/app/server/data homedash
```

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
NODE_ENV=production
PORT=3001
MAX_BACKUPS=10
AUTO_BACKUP=true
```

## Default Services

The dashboard comes pre-configured with common homelab services:

### Media
- Jellyfin - Media Server & Streaming
- Emby - Personal Media Server

### Media Management
- Sonarr - TV Series Management
- Radarr - Movie Management
- Prowlarr - Indexer Manager

### Downloads
- qBittorrent - BitTorrent Client

### Infrastructure
- Portainer - Docker Management
- Pi-hole - Network Ad Blocker

### Home Automation
- Home Assistant - Smart Home Hub

### Monitoring
- Grafana - Analytics & Monitoring

## Usage

### Adding Services
1. Click the "Add Service" button
2. Fill in the service details:
   - **Name**: Display name for your service
   - **URL**: The web interface URL
   - **Icon**: FontAwesome class (e.g., `fas fa-tv`) or image URL
   - **Category**: Group your services (e.g., "Media", "Infrastructure")
   - **Description**: Brief description of the service

### Managing Services
- **Right-click** any service card to see options:
  - Edit Service
  - Duplicate Service
  - Delete Service

### Keyboard Shortcuts
- **Ctrl+K**: Focus search box
- **Escape**: Close modals and menus
- **/** : Alternative search focus

### Configuration Management
- **Export**: Download your configuration as JSON
- **Import**: Upload a JSON configuration file
- **Reset**: Clear all data and start fresh

## Technical Details

### Technology Stack
- **Frontend**: Pure HTML5, CSS3, JavaScript
- **Framework**: Alpine.js (lightweight reactive framework)
- **Icons**: FontAwesome 6 + Material Icons
- **Storage**: Browser localStorage
- **Responsive**: CSS Grid + Flexbox

### Browser Support
- Chrome/Edge 60+
- Firefox 60+
- Safari 12+
- Modern mobile browsers

### File Structure
```
homedash/
├── index.html              # Main dashboard file
├── README.md              # This documentation
├── architecture-blueprint.md  # Technical architecture
└── docs/                  # Additional documentation
```

## Deployment Options

### 1. Local File
- Simply open `index.html` in your browser
- Works offline, data stored locally

### 2. Web Server
```bash
# Python
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

### 3. Static Hosting
- GitHub Pages
- Netlify
- Vercel
- Any static file hosting

### 4. Docker
```dockerfile
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/
EXPOSE 80
```

## Configuration Format

The dashboard uses a simple JSON format for configuration:

```json
{
  "services": [
    {
      "name": "Service Name",
      "url": "http://service.local:port",
      "icon": "fas fa-icon-name",
      "category": "Category Name",
      "description": "Service description"
    }
  ],
  "collapsedCategories": [],
  "gridColumns": 4
}
```

## Contributing

This is a single-file dashboard designed for simplicity. If you'd like to contribute:

1. Fork the repository
2. Make your changes to `index.html`
3. Test thoroughly across different browsers
4. Submit a pull request

## License

MIT License - Feel free to use and modify for your homelab!

## Support

Having issues? Check the browser console for error messages and ensure you're using a modern browser with JavaScript enabled.
