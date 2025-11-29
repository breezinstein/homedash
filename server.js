import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const CONFIG_PATH = join(__dirname, 'data', 'config.json');
const BACKUPS_DIR = join(__dirname, 'data', 'backups');

// Track file modification time for change detection
let lastModified = 0;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure data directory exists
mkdirSync(join(__dirname, 'data'), { recursive: true });
mkdirSync(BACKUPS_DIR, { recursive: true });

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
    
    const filename = `${Date.now()}-${req.query.name || 'icon.png'}`;
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
