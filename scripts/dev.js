#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const serverDir = path.join(__dirname, '..', 'server');
const packagePath = path.join(serverDir, 'package.json');

// Check if server dependencies are installed
if (!fs.existsSync(path.join(serverDir, 'node_modules'))) {
    console.log('📦 Installing server dependencies...');
    const install = spawn('npm', ['install'], { 
        cwd: serverDir, 
        stdio: 'inherit',
        shell: process.platform === 'win32'
    });
    
    install.on('close', (code) => {
        if (code === 0) {
            startServer();
        } else {
            console.error('❌ Failed to install dependencies');
            process.exit(1);
        }
    });
} else {
    startServer();
}

function startServer() {
    console.log('🚀 Starting Homedash development server...');
    
    const server = spawn('npm', ['run', 'dev'], { 
        cwd: serverDir, 
        stdio: 'inherit',
        shell: process.platform === 'win32'
    });
    
    server.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down server...');
        server.kill('SIGTERM');
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        server.kill('SIGTERM');
        process.exit(0);
    });
}
