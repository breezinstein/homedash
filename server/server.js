const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const CONFIG_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const BACKUP_DIR = path.join(CONFIG_DIR, 'backups');

// Ensure directories exist
fs.ensureDirSync(CONFIG_DIR);
fs.ensureDirSync(BACKUP_DIR);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../')));

// Default configuration
const defaultConfig = {
  services: [
    {
      name: 'Jellyfin',
      url: 'http://jellyfin.local:8096',
      icon: 'fas fa-tv',
      category: 'Media',
      description: 'Media Server & Streaming'
    },
    {
      name: 'Emby',
      url: 'http://emby.local:8096',
      icon: 'fas fa-film',
      category: 'Media',
      description: 'Personal Media Server'
    },
    {
      name: 'Sonarr',
      url: 'http://sonarr.local:8989',
      icon: 'fas fa-tv',
      category: 'Media Management',
      description: 'TV Series Management'
    },
    {
      name: 'Radarr',
      url: 'http://radarr.local:7878',
      icon: 'fas fa-film',
      category: 'Media Management',
      description: 'Movie Management'
    },
    {
      name: 'Prowlarr',
      url: 'http://prowlarr.local:9696',
      icon: 'fas fa-search',
      category: 'Media Management',
      description: 'Indexer Manager'
    },
    {
      name: 'qBittorrent',
      url: 'http://qbittorrent.local:8080',
      icon: 'fas fa-download',
      category: 'Downloads',
      description: 'BitTorrent Client'
    },
    {
      name: 'Portainer',
      url: 'http://portainer.local:9000',
      icon: 'fab fa-docker',
      category: 'Infrastructure',
      description: 'Docker Management'
    },
    {
      name: 'Pi-hole',
      url: 'http://pihole.local/admin',
      icon: 'fas fa-shield-alt',
      category: 'Infrastructure',
      description: 'Network Ad Blocker'
    },
    {
      name: 'Home Assistant',
      url: 'http://homeassistant.local:8123',
      icon: 'fas fa-home',
      category: 'Home Automation',
      description: 'Smart Home Hub'
    },
    {
      name: 'Grafana',
      url: 'http://grafana.local:3000',
      icon: 'fas fa-chart-line',
      category: 'Monitoring',
      description: 'Analytics & Monitoring'
    }
  ],
  collapsedCategories: [],
  gridColumns: 4,
  theme: 'dark',
  settings: {
    weatherApiKey: '',
    timezone: 'UTC',
    customCSS: '',
    autoSync: true,
    syncInterval: 30000
  },
  metadata: {
    version: '1.0.0',
    lastModified: new Date().toISOString(),
    backupEnabled: true
  }
};

// Helper functions
async function loadConfig() {
  try {
    if (await fs.pathExists(CONFIG_FILE)) {
      const config = await fs.readJson(CONFIG_FILE);
      return { ...defaultConfig, ...config };
    }
    return defaultConfig;
  } catch (error) {
    console.error('Error loading config:', error);
    return defaultConfig;
  }
}

async function saveConfig(config) {
  try {
    // Create backup before saving
    if (await fs.pathExists(CONFIG_FILE)) {
      await createBackup();
    }
    
    config.metadata = {
      ...config.metadata,
      lastModified: new Date().toISOString()
    };
    
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `config-backup-${timestamp}.json`);
    await fs.copy(CONFIG_FILE, backupFile);
    
    // Clean old backups (keep last 10)
    const backups = await fs.readdir(BACKUP_DIR);
    const sortedBackups = backups
      .filter(file => file.startsWith('config-backup-'))
      .sort()
      .reverse();
    
    if (sortedBackups.length > 10) {
      for (let i = 10; i < sortedBackups.length; i++) {
        await fs.remove(path.join(BACKUP_DIR, sortedBackups[i]));
      }
    }
    
    return backupFile;
  } catch (error) {
    console.error('Error creating backup:', error);
    return null;
  }
}

function validateService(service) {
  const errors = [];
  
  if (!service.name || typeof service.name !== 'string') {
    errors.push('Service name is required and must be a string');
  }
  
  if (!service.url || typeof service.url !== 'string') {
    errors.push('Service URL is required and must be a string');
  }
  
  if (!service.category || typeof service.category !== 'string') {
    errors.push('Service category is required and must be a string');
  }
  
  if (service.icon && typeof service.icon !== 'string') {
    errors.push('Service icon must be a string');
  }
  
  if (service.description && typeof service.description !== 'string') {
    errors.push('Service description must be a string');
  }
  
  return errors;
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Get current configuration
app.get('/api/config', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /api/config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// Save complete configuration
app.post('/api/config', async (req, res) => {
  try {
    const config = req.body;
    
    // Validate required fields
    if (!config.services || !Array.isArray(config.services)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration: services must be an array',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate each service
    for (let i = 0; i < config.services.length; i++) {
      const errors = validateService(config.services[i]);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid service at index ${i}: ${errors.join(', ')}`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const saved = await saveConfig(config);
    if (saved) {
      res.json({
        success: true,
        message: 'Configuration saved successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to save configuration',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('POST /api/config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// Add a new service
app.post('/api/services', async (req, res) => {
  try {
    const service = req.body;
    const config = await loadConfig();
    
    // Validate service
    const errors = validateService(service);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }
    
    // Check for duplicate names
    if (config.services.some(s => s.name === service.name)) {
      return res.status(400).json({
        success: false,
        error: 'Service with this name already exists',
        timestamp: new Date().toISOString()
      });
    }
    
    config.services.push(service);
    const saved = await saveConfig(config);
    
    if (saved) {
      res.json({
        success: true,
        message: 'Service added successfully',
        service: service,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to add service',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('POST /api/services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add service',
      timestamp: new Date().toISOString()
    });
  }
});

// Update a service
app.put('/api/services/:name', async (req, res) => {
  try {
    const serviceName = decodeURIComponent(req.params.name);
    const updatedService = req.body;
    const config = await loadConfig();
    
    // Validate service
    const errors = validateService(updatedService);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }
    
    const serviceIndex = config.services.findIndex(s => s.name === serviceName);
    if (serviceIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check for duplicate names (excluding current service)
    if (updatedService.name !== serviceName && 
        config.services.some(s => s.name === updatedService.name)) {
      return res.status(400).json({
        success: false,
        error: 'Service with this name already exists',
        timestamp: new Date().toISOString()
      });
    }
    
    config.services[serviceIndex] = updatedService;
    const saved = await saveConfig(config);
    
    if (saved) {
      res.json({
        success: true,
        message: 'Service updated successfully',
        service: updatedService,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update service',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('PUT /api/services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service',
      timestamp: new Date().toISOString()
    });
  }
});

// Delete a service
app.delete('/api/services/:name', async (req, res) => {
  try {
    const serviceName = decodeURIComponent(req.params.name);
    const config = await loadConfig();
    
    const initialLength = config.services.length;
    config.services = config.services.filter(s => s.name !== serviceName);
    
    if (config.services.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const saved = await saveConfig(config);
    
    if (saved) {
      res.json({
        success: true,
        message: 'Service deleted successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete service',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('DELETE /api/services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete service',
      timestamp: new Date().toISOString()
    });
  }
});

// Get services list
app.get('/api/services', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json({
      success: true,
      data: config.services,
      count: config.services.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /api/services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load services',
      timestamp: new Date().toISOString()
    });
  }
});

// Get backups list
app.get('/api/backups', async (req, res) => {
  try {
    const backups = await fs.readdir(BACKUP_DIR);
    const backupFiles = backups
      .filter(file => file.startsWith('config-backup-'))
      .map(file => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        return {
          filename: file,
          path: `/api/backups/${encodeURIComponent(file)}`,
          created: stats.birthtime.toISOString(),
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json({
      success: true,
      data: backupFiles,
      count: backupFiles.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /api/backups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list backups',
      timestamp: new Date().toISOString()
    });
  }
});

// Download backup
app.get('/api/backups/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const backupFile = path.join(BACKUP_DIR, filename);
    
    // Security check - ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
        timestamp: new Date().toISOString()
      });
    }
    
    if (await fs.pathExists(backupFile)) {
      res.download(backupFile, filename);
    } else {
      res.status(404).json({
        success: false,
        error: 'Backup file not found',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('GET /api/backups/:filename error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download backup',
      timestamp: new Date().toISOString()
    });
  }
});

// Create manual backup
app.post('/api/backup', async (req, res) => {
  try {
    const backupFile = await createBackup();
    if (backupFile) {
      res.json({
        success: true,
        message: 'Backup created successfully',
        filename: path.basename(backupFile),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create backup',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('POST /api/backup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      timestamp: new Date().toISOString()
    });
  }
});

// Update settings only
app.patch('/api/settings', async (req, res) => {
  try {
    const newSettings = req.body;
    const config = await loadConfig();
    
    config.settings = { ...config.settings, ...newSettings };
    const saved = await saveConfig(config);
    
    if (saved) {
      res.json({
        success: true,
        message: 'Settings updated successfully',
        settings: config.settings,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update settings',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('PATCH /api/settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      timestamp: new Date().toISOString()
    });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      timestamp: new Date().toISOString()
    });
  } else {
    res.sendFile(path.join(__dirname, '../index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🏠 Homedash Server running on port ${PORT}`);
  console.log(`📂 Config directory: ${CONFIG_DIR}`);
  console.log(`💾 Backup directory: ${BACKUP_DIR}`);
  console.log(`🌐 Access dashboard at: http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Server shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Server shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
