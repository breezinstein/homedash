# Deployment Guide

This guide covers various ways to deploy the Homelab Dashboard.

## Quick Start (Local File)

The simplest way to use the dashboard:

1. Download `index.html` to your computer
2. Double-click to open in your browser
3. Start adding your services!

**Pros**: No server required, works offline  
**Cons**: Limited to single device unless you manually sync the file

## Web Server Deployment

### Python HTTP Server (Development)
```bash
cd homedash
python -m http.server 8000
# Visit http://localhost:8000
```

### Node.js HTTP Server
```bash
npm install -g http-server
cd homedash
http-server -p 8000
# Visit http://localhost:8000
```

### PHP Built-in Server
```bash
cd homedash
php -S localhost:8000
# Visit http://localhost:8000
```

## Production Deployments

### Apache
```apache
<VirtualHost *:80>
    ServerName homedash.local
    DocumentRoot /var/www/homedash
    
    <Directory /var/www/homedash>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Nginx
```nginx
server {
    listen 80;
    server_name homedash.local;
    root /var/www/homedash;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    # Optional: Enable gzip compression
    gzip on;
    gzip_types text/html text/css application/javascript;
}
```

### Docker

#### Simple Nginx Container
```dockerfile
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t homedash .
docker run -d -p 8080:80 homedash
```

#### Docker Compose
```yaml
version: '3.8'
services:
  homedash:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

## Static Hosting Services

### GitHub Pages
1. Push your code to a GitHub repository
2. Go to Settings → Pages
3. Select source branch (usually `main`)
4. Your dashboard will be available at `https://username.github.io/homedash`

### Netlify
1. Connect your GitHub repository
2. Build settings: Leave empty (no build required)
3. Publish directory: `/` (root)
4. Deploy automatically on git push

### Vercel
1. Import your GitHub repository
2. Framework: Other
3. Build command: Leave empty
4. Output directory: `./`
5. Deploy!

### Cloudflare Pages
1. Connect your GitHub repository
2. Build settings: Leave default
3. Deploy and get a `.pages.dev` domain

## Network Storage Solutions

### Synology NAS
1. Upload `index.html` to Web Station
2. Create a virtual host pointing to the file
3. Access via your NAS IP

### QNAP NAS
1. Use File Station to upload to `Web` folder
2. Access via `http://nas-ip/homedash/`

### Raspberry Pi
```bash
# Install Apache
sudo apt update
sudo apt install apache2

# Copy file
sudo cp index.html /var/www/html/homedash.html

# Access via http://pi-ip/homedash.html
```

## Reverse Proxy Setup

### Traefik (Docker)
```yaml
version: '3.8'
services:
  homedash:
    image: nginx:alpine
    volumes:
      - ./index.html:/usr/share/nginx/html/index.html:ro
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.homedash.rule=Host(`dash.local`)"
      - "traefik.http.services.homedash.loadbalancer.server.port=80"
```

### Nginx Proxy Manager
1. Add new proxy host
2. Domain: `dash.local`
3. Forward to: `homedash-container:80`
4. Enable SSL if desired

### Caddy
```caddyfile
dash.local {
    reverse_proxy homedash-container:80
}
```

## SSL/HTTPS Setup

### Let's Encrypt with Certbot
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d homedash.yourdomain.com
```

### Self-signed Certificate (Development)
```bash
# Generate certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Use with nginx
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
```

## Security Considerations

### Basic Authentication
```nginx
# Create password file
sudo htpasswd -c /etc/nginx/.htpasswd username

# Nginx config
location / {
    auth_basic "Homelab Dashboard";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

### IP Restriction
```nginx
location / {
    allow 192.168.1.0/24;  # Your local network
    deny all;
}
```

### VPN Access Only
Consider placing behind:
- Tailscale
- WireGuard
- OpenVPN

## Performance Optimization

### Nginx Caching
```nginx
location ~* \.(css|js|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Gzip Compression
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/html text/css application/javascript;
```

## Monitoring

### Basic Access Logs
```bash
# Nginx logs
tail -f /var/log/nginx/access.log

# Apache logs
tail -f /var/log/apache2/access.log
```

### Uptime Monitoring
Use services like:
- UptimeRobot
- Pingdom
- StatusCake
- Self-hosted: Uptime Kuma

## Backup Strategy

### Configuration Backup
The dashboard stores configuration in localStorage. To backup:

1. Use the "Export Configuration" button in settings
2. Store the JSON file in a safe location
3. Restore using "Import Configuration"

### Automated Backup Script
```bash
#!/bin/bash
# backup-homedash.sh

# Set variables
SOURCE="/var/www/homedash"
BACKUP_DIR="/backups/homedash"
DATE=$(date +"%Y%m%d_%H%M%S")

# Create backup
cp -r "$SOURCE" "$BACKUP_DIR/homedash_$DATE"

# Keep only last 10 backups
ls -t "$BACKUP_DIR" | tail -n +11 | xargs -r rm -rf

echo "Backup completed: homedash_$DATE"
```

## Troubleshooting

### Common Issues

1. **Blank page**: Check browser console for JavaScript errors
2. **Icons not loading**: Verify FontAwesome CDN is accessible
3. **Services not saving**: Check localStorage is enabled
4. **Mobile layout issues**: Verify viewport meta tag is present

### Debug Mode
Add this to see debug information:
```javascript
// Add to browser console
localStorage.setItem('debug', 'true');
location.reload();
```

### Browser Compatibility
- Ensure you're using a modern browser
- Check for JavaScript and localStorage support
- Verify CSS Grid support for layout
