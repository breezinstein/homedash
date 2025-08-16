const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const CONFIG_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const BACKUP_DIR = path.join(CONFIG_DIR, 'backups');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure directories exist
fs.ensureDirSync(CONFIG_DIR);
fs.ensureDirSync(BACKUP_DIR);
fs.ensureDirSync(UPLOADS_DIR);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${timestamp}-${name}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http://localhost:*"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../')));

// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

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
    backupEnabled: true,
    lastBackup: null,
    backupCadenceMinutes: 60, // Only create backups every 60 minutes if changes exist
    configHash: null // Track if config has actually changed
  }
};

// Helper functions
function generateConfigHash(config) {
  // Create a hash of the important parts of the config (excluding metadata)
  const configForHashing = {
    services: config.services,
    collapsedCategories: config.collapsedCategories,
    gridColumns: config.gridColumns,
    theme: config.theme,
    settings: config.settings,
    categoryOrder: config.categoryOrder
  };
  
  const configString = JSON.stringify(configForHashing, Object.keys(configForHashing).sort());
  return crypto.createHash('sha256').update(configString).digest('hex');
}

function shouldCreateBackup(config) {
  // Don't backup if backups are disabled
  if (!config.metadata?.backupEnabled) {
    return false;
  }
  
  // Always create backup if no previous backup exists
  if (!config.metadata?.lastBackup) {
    return true;
  }
  
  // Check if enough time has passed since last backup
  const lastBackupTime = new Date(config.metadata.lastBackup);
  const now = new Date();
  const minutesSinceLastBackup = (now - lastBackupTime) / (1000 * 60);
  const cadenceMinutes = config.metadata?.backupCadenceMinutes || 60;
  
  if (minutesSinceLastBackup < cadenceMinutes) {
    return false;
  }
  
  // Check if config has actually changed
  const currentHash = generateConfigHash(config);
  const lastHash = config.metadata?.configHash;
  
  return currentHash !== lastHash;
}

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
    // Generate hash of the new config
    const newConfigHash = generateConfigHash(config);
    
    // Load existing config to check if backup is needed
    let existingConfig = null;
    if (await fs.pathExists(CONFIG_FILE)) {
      try {
        existingConfig = await fs.readJson(CONFIG_FILE);
      } catch (error) {
        console.warn('Could not read existing config for backup check:', error.message);
      }
    }
    
    // Create backup if needed (before saving new config)
    if (existingConfig && shouldCreateBackup({ ...existingConfig, metadata: { ...existingConfig.metadata, configHash: newConfigHash } })) {
      console.log('Creating backup due to configuration changes...');
      await createBackup();
    }
    
    // Update metadata
    config.metadata = {
      ...config.metadata,
      lastModified: new Date().toISOString(),
      configHash: newConfigHash
    };
    
    // If we created a backup, update the lastBackup timestamp
    if (existingConfig && shouldCreateBackup({ ...existingConfig, metadata: { ...existingConfig.metadata, configHash: newConfigHash } })) {
      config.metadata.lastBackup = new Date().toISOString();
    }
    
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

async function createBackup() {
  try {
    // Ensure the source config file exists and is not empty
    if (!(await fs.pathExists(CONFIG_FILE))) {
      console.warn('Cannot create backup: config file does not exist');
      return null;
    }
    
    // Read and validate the config before backing it up
    let config;
    try {
      config = await fs.readJson(CONFIG_FILE);
    } catch (error) {
      console.error('Cannot create backup: config file is corrupted or empty:', error.message);
      return null;
    }
    
    // Safety check: ensure config has services array to prevent backing up empty/invalid configs
    if (!config || !config.services || !Array.isArray(config.services)) {
      console.error('Cannot create backup: config is missing services array or is invalid');
      return null;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `config-backup-${timestamp}.json`);
    
    // Copy the validated config to backup
    await fs.copy(CONFIG_FILE, backupFile);
    
    console.log(`Backup created: ${path.basename(backupFile)} (${config.services.length} services)`);
    
    // Clean old backups (keep last 10)
    const backups = await fs.readdir(BACKUP_DIR);
    const sortedBackups = backups
      .filter(file => file.startsWith('config-backup-'))
      .sort()
      .reverse();
    
    if (sortedBackups.length > 10) {
      for (let i = 10; i < sortedBackups.length; i++) {
        await fs.remove(path.join(BACKUP_DIR, sortedBackups[i]));
        console.log(`Removed old backup: ${sortedBackups[i]}`);
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

// Upload image endpoint
app.post('/api/upload-icon', upload.single('icon'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        timestamp: new Date().toISOString()
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file',
      timestamp: new Date().toISOString()
    });
  }
});

// Delete uploaded image endpoint
app.delete('/api/uploads/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Security check - ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
        timestamp: new Date().toISOString()
      });
    }
    
    const filePath = path.join(UPLOADS_DIR, filename);
    
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      res.json({
        success: true,
        message: 'File deleted successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'File not found',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      timestamp: new Date().toISOString()
    });
  }
});

// List uploaded images endpoint
app.get('/api/uploads', async (req, res) => {
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    const imageFiles = [];
    
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile() && /\.(jpg|jpeg|png|gif|svg|webp|ico)$/i.test(file)) {
        imageFiles.push({
          filename: file,
          url: `/uploads/${file}`,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString()
        });
      }
    }
    
    // Sort by creation date, newest first
    imageFiles.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json({
      success: true,
      data: imageFiles,
      count: imageFiles.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('List uploads error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list uploaded files',
      timestamp: new Date().toISOString()
    });
  }
});

// Clean up unused images endpoint
app.post('/api/uploads/cleanup', async (req, res) => {
  try {
    const config = await loadConfig();
    const usedImages = new Set();
    
    // Collect all used image URLs
    config.services.forEach(service => {
      if (service.icon && service.icon.startsWith('/uploads/')) {
        usedImages.add(service.icon.replace('/uploads/', ''));
      }
    });
    
    const files = await fs.readdir(UPLOADS_DIR);
    const deletedFiles = [];
    
    for (const file of files) {
      if (/\.(jpg|jpeg|png|gif|svg|webp|ico)$/i.test(file) && !usedImages.has(file)) {
        const filePath = path.join(UPLOADS_DIR, file);
        await fs.remove(filePath);
        deletedFiles.push(file);
      }
    }
    
    res.json({
      success: true,
      message: `Cleaned up ${deletedFiles.length} unused images`,
      deletedFiles: deletedFiles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup unused images',
      timestamp: new Date().toISOString()
    });
  }
});

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
    // For manual backups, always create backup but still validate the config
    const backupFile = await createBackup();
    if (backupFile) {
      // Update the lastBackup timestamp in config
      const config = await loadConfig();
      config.metadata.lastBackup = new Date().toISOString();
      await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
      
      res.json({
        success: true,
        message: 'Backup created successfully',
        filename: path.basename(backupFile),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create backup - configuration may be invalid or empty',
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

// Restore from backup
app.post('/api/restore/:filename', async (req, res) => {
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
    
    // Check if backup file exists
    if (!(await fs.pathExists(backupFile))) {
      return res.status(404).json({
        success: false,
        error: 'Backup file not found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Create a backup of current config before restoring
    const currentBackupFile = await createBackup();
    if (!currentBackupFile) {
      console.warn('Failed to create backup before restore, proceeding anyway');
    }
    
    // Read and validate the backup file
    let backupConfig;
    try {
      backupConfig = await fs.readJson(backupFile);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup file format',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate the backup configuration structure
    if (!backupConfig.services || !Array.isArray(backupConfig.services)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup: missing or invalid services array',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate each service in the backup
    for (let i = 0; i < backupConfig.services.length; i++) {
      const errors = validateService(backupConfig.services[i]);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid service at index ${i}: ${errors.join(', ')}`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Merge with default config to ensure all required fields are present
    const restoredConfig = {
      ...defaultConfig,
      ...backupConfig,
      metadata: {
        ...defaultConfig.metadata,
        ...backupConfig.metadata,
        lastModified: new Date().toISOString(),
        restoredFrom: filename,
        restoredAt: new Date().toISOString()
      }
    };
    
    // Save the restored configuration
    const saved = await saveConfig(restoredConfig);
    
    if (saved) {
      res.json({
        success: true,
        message: 'Configuration restored successfully',
        data: {
          restoredFrom: filename,
          servicesCount: restoredConfig.services.length,
          currentBackup: currentBackupFile ? path.basename(currentBackupFile) : null
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to save restored configuration',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('POST /api/restore error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore from backup',
      timestamp: new Date().toISOString()
    });
  }
});

// Update settings only
app.patch('/api/settings', async (req, res) => {
  try {
    const newSettings = req.body;
    const config = await loadConfig();
    
    // Handle backup-specific settings in metadata
    if (newSettings.backupEnabled !== undefined) {
      config.metadata.backupEnabled = newSettings.backupEnabled;
      delete newSettings.backupEnabled;
    }
    
    if (newSettings.backupCadenceMinutes !== undefined) {
      config.metadata.backupCadenceMinutes = Math.max(5, Math.min(1440, parseInt(newSettings.backupCadenceMinutes) || 60));
      delete newSettings.backupCadenceMinutes;
    }
    
    // Update regular settings
    config.settings = { ...config.settings, ...newSettings };
    
    const saved = await saveConfig(config);
    
    if (saved) {
      res.json({
        success: true,
        message: 'Settings updated successfully',
        settings: config.settings,
        metadata: config.metadata,
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
  
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 5MB.',
        timestamp: new Date().toISOString()
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle other file upload errors
  if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      error: 'Only image files are allowed. Supported formats: JPG, PNG, GIF, SVG, WebP, ICO',
      timestamp: new Date().toISOString()
    });
  }
  
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
