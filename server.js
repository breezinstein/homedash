import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync, unlinkSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename, extname } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const CONFIG_PATH = join(__dirname, 'data', 'config.json');
const BACKUPS_DIR = join(__dirname, 'data', 'backups');
const ICONS_CACHE_DIR = join(__dirname, 'data', 'icons');

// Track file modification time for change detection
let lastModified = 0;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure data directory exists (with error handling for disk space issues)
try {
  mkdirSync(join(__dirname, 'data'), { recursive: true });
  mkdirSync(BACKUPS_DIR, { recursive: true });
  mkdirSync(ICONS_CACHE_DIR, { recursive: true });
} catch (error) {
  console.error('Warning: Could not create data directories:', error.message);
  // Continue anyway - the app can still work without icon caching
}

// Default config
const defaultConfig = {
  services: [],
  collapsedCategories: [],
  gridColumns: "3",
  theme: "dark",
  settings: {
    timezone: "UTC",
    customCSS: "",
    autoSync: true,
    syncInterval: 5000
  },
  metadata: {
    version: "1.0.0",
    lastModified: new Date().toISOString(),
    backupEnabled: true,
    lastBackup: new Date().toISOString(),
    backupCadenceMinutes: 60,
    configHash: ""
  },
  categoryOrder: [],
  colors: {
    primary: "#6366f1",
    secondary: "#475569",
    background: "#0a0a0a",
    surface: "#1a1a1a",
    textPrimary: "#ffffff",
    textSecondary: "#a1a1aa",
    border: "#27272a",
    accent: "#8b5cf6",
    success: "#22c55e",
    warning: "#eab308",
    error: "#f87171"
  }
};

// Initialize config file if it doesn't exist
if (!existsSync(CONFIG_PATH)) {
  writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  console.log('Created default config.json');
}

// Update last modified time
function updateLastModified() {
  try {
    const stats = statSync(CONFIG_PATH);
    lastModified = stats.mtimeMs;
  } catch (e) {
    lastModified = 0;
  }
}
updateLastModified();

// GET /api/config - Read config
app.get('/api/config', (req, res) => {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const stats = statSync(CONFIG_PATH);
    res.json({ 
      config, 
      lastModified: stats.mtimeMs 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// PUT /api/config - Write config
app.put('/api/config', (req, res) => {
  try {
    const config = {
      ...req.body,
      metadata: {
        ...req.body.metadata,
        lastModified: new Date().toISOString()
      }
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    updateLastModified();
    res.json({ success: true, lastModified });
  } catch (error) {
    res.status(500).json({ error: 'Failed to write config' });
  }
});

// GET /api/config/check - Check if config changed
app.get('/api/config/check', (req, res) => {
  try {
    const clientLastModified = parseFloat(req.query.since) || 0;
    const stats = statSync(CONFIG_PATH);
    const changed = stats.mtimeMs > clientLastModified;
    res.json({ changed, lastModified: stats.mtimeMs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check config' });
  }
});

// GET /api/backups - List backups
app.get('/api/backups', (req, res) => {
  try {
    const files = readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = join(BACKUPS_DIR, f);
        const stats = statSync(filePath);
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        return {
          name: f.replace('.json', ''),
          date: stats.mtime.toISOString(),
          filename: f,
          serviceCount: data.services?.length || 0
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(files);
  } catch (error) {
    res.json([]);
  }
});

// POST /api/backups - Create backup
app.post('/api/backups', (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = req.body.name || `backup-${timestamp}`;
    const filename = `${name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    writeFileSync(join(BACKUPS_DIR, filename), JSON.stringify(config, null, 2));
    res.json({ success: true, filename });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// POST /api/backups/restore/:filename - Restore backup
app.post('/api/backups/restore/:filename', (req, res) => {
  try {
    const backupPath = join(BACKUPS_DIR, req.params.filename);
    if (!existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    const backup = readFileSync(backupPath, 'utf-8');
    writeFileSync(CONFIG_PATH, backup);
    updateLastModified();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// DELETE /api/backups/:filename - Delete backup
app.delete('/api/backups/:filename', (req, res) => {
  try {
    const backupPath = join(BACKUPS_DIR, req.params.filename);
    if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// Serve uploaded icons
app.use('/uploads', express.static(join(__dirname, 'data', 'uploads')));

// Serve cached icons
app.use('/icons', express.static(ICONS_CACHE_DIR));

// GET /api/icons/proxy - Proxy and cache external icon
app.get('/api/icons/proxy', async (req, res) => {
  try {
    const iconUrl = req.query.url;
    if (!iconUrl) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(iconUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Create a hash of the URL for the filename
    const urlHash = crypto.createHash('md5').update(iconUrl).digest('hex');
    
    // Try to determine extension from URL
    let ext = extname(parsedUrl.pathname).toLowerCase();
    if (!ext || !['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'].includes(ext)) {
      ext = '.png'; // Default to png
    }
    
    const cachedFilename = `${urlHash}${ext}`;
    const cachedPath = join(ICONS_CACHE_DIR, cachedFilename);

    // Check if already cached
    if (existsSync(cachedPath)) {
      return res.json({ 
        cached: true, 
        url: `/icons/${cachedFilename}` 
      });
    }

    // Fetch the icon with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let response;
    try {
      response = await fetch(iconUrl, {
        headers: {
          'User-Agent': 'HomeDash/1.0',
          'Accept': 'image/*'
        },
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      console.error('Icon fetch error:', fetchError.message);
      // Return original URL as fallback - let client try directly
      return res.json({ 
        cached: false, 
        url: iconUrl,
        fallback: true 
      });
    }
    clearTimeout(timeout);

    if (!response.ok) {
      // Return original URL as fallback
      return res.json({ 
        cached: false, 
        url: iconUrl,
        fallback: true 
      });
    }

    // Get content type and adjust extension if needed
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('svg')) {
      ext = '.svg';
    } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      ext = '.jpg';
    } else if (contentType.includes('gif')) {
      ext = '.gif';
    } else if (contentType.includes('webp')) {
      ext = '.webp';
    } else if (contentType.includes('ico') || contentType.includes('x-icon')) {
      ext = '.ico';
    }

    const finalFilename = `${urlHash}${ext}`;
    const finalPath = join(ICONS_CACHE_DIR, finalFilename);

    // Save to cache
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(finalPath, buffer);

    res.json({ 
      cached: false, 
      url: `/icons/${finalFilename}` 
    });
  } catch (error) {
    console.error('Icon proxy error:', error.message);
    // Return original URL as fallback instead of error
    const iconUrl = req.query.url;
    res.json({ 
      cached: false, 
      url: iconUrl,
      fallback: true,
      error: error.message 
    });
  }
});

// GET /api/icons/cache-info - Get cache statistics
app.get('/api/icons/cache-info', (req, res) => {
  try {
    const files = readdirSync(ICONS_CACHE_DIR);
    let totalSize = 0;
    
    files.forEach(file => {
      const stats = statSync(join(ICONS_CACHE_DIR, file));
      totalSize += stats.size;
    });

    res.json({
      count: files.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize)
    });
  } catch (error) {
    res.json({ count: 0, totalSize: 0, totalSizeFormatted: '0 B' });
  }
});

// DELETE /api/icons/cache - Clear icon cache
app.delete('/api/icons/cache', (req, res) => {
  try {
    const files = readdirSync(ICONS_CACHE_DIR);
    let deletedCount = 0;

    files.forEach(file => {
      try {
        unlinkSync(join(ICONS_CACHE_DIR, file));
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete ${file}:`, e.message);
      }
    });

    res.json({ success: true, deletedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Serve static files in production
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// POST /api/upload-icon - Upload icon file
app.post('/api/upload-icon', express.raw({ type: 'image/*', limit: '5mb' }), (req, res) => {
  try {
    const uploadsDir = join(__dirname, 'data', 'uploads');
    mkdirSync(uploadsDir, { recursive: true });
    
    // Sanitize filename to prevent path traversal attacks
    const rawName = String(req.query.name || 'icon.png');
    const safeName = basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${safeName || 'icon.png'}`;
    writeFileSync(join(uploadsDir, filename), req.body);
    res.json({ url: `/uploads/${filename}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload icon' });
  }
});

// SPA fallback - serve index.html for all non-API routes
if (existsSync(distPath)) {
  app.get('/{*splat}', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n🚀 Config API server running on http://localhost:${PORT}`);
  console.log(`📁 Config file: ${CONFIG_PATH}`);
  console.log(`💾 Backups dir: ${BACKUPS_DIR}\n`);
});
