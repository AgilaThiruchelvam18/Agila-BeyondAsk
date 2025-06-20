#!/usr/bin/env node

// Fix ES module syntax errors by processing TypeScript imports
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Fixing ES module syntax errors...');

// Clean and create deployment
if (fs.existsSync('dist')) execSync('rm -rf dist');
fs.mkdirSync('dist', { recursive: true });

// Create production frontend
const frontend = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BeyondAsk AI Platform</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
        h1 { color: #1e293b; margin-bottom: 1rem; }
        .status { margin: 1rem 0; padding: 1rem; background: #f1f5f9; border-radius: 4px; }
        .link { color: #3b82f6; text-decoration: none; margin: 0 1rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>BeyondAsk AI Platform</h1>
        <div class="status" id="status">Connecting to server...</div>
        <div><a href="/api/health" class="link">Health Check</a><a href="/api-docs" class="link">API Documentation</a></div>
    </div>
    <script>
        fetch('/api/health').then(r => r.json()).then(data => {
            document.getElementById('status').innerHTML = 'Server Status: <strong>' + data.status + '</strong><br>Environment: ' + data.environment;
        }).catch(() => setTimeout(() => location.reload(), 2000));
    </script>
</body>
</html>`;

fs.mkdirSync('dist/public', { recursive: true });
fs.writeFileSync('dist/public/index.html', frontend);

// Copy server files and fix TypeScript imports
function copyAndFixFile(srcPath, destPath) {
  let content = fs.readFileSync(srcPath, 'utf8');
  
  // Fix TypeScript type imports that cause ES module syntax errors
  content = content.replace(/import\s*{([^}]*)\btype\s+(\w+)([^}]*)\}/g, 
    (match, before, typeName, after) => {
      // Remove 'type' keyword but keep the import
      const cleanBefore = before.replace(/,\s*$/, '');
      const cleanAfter = after.replace(/^\s*,/, '');
      return `import {${cleanBefore ? cleanBefore + ', ' : ''}${typeName}${cleanAfter ? ', ' + cleanAfter : ''}}`;
    }
  );
  
  // Also handle standalone type imports
  content = content.replace(/import\s*{\s*type\s+(\w+)\s*}\s*from/g, 'import { $1 } from');
  
  fs.writeFileSync(destPath, content);
}

// Copy and fix server directory
function copyServerDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const items = fs.readdirSync(src);
  
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyServerDirectory(srcPath, destPath);
    } else if (item.endsWith('.ts') || item.endsWith('.js')) {
      copyAndFixFile(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy and fix all server files
copyServerDirectory('server', 'dist/server');
copyServerDirectory('shared', 'dist/shared');

// Copy configuration files
const configFiles = ['vite.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.js'];
for (const file of configFiles) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('dist', file));
  }
}

// Copy client directory
execSync('cp -r client dist/');

// Create test directory for pdf-parse
fs.mkdirSync('dist/test/data', { recursive: true });
fs.writeFileSync('dist/test/data/05-versions-space.pdf', 'dummy file for pdf-parse');

// Create production package.json
const originalPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const prodPkg = {
  "name": "beyondask-production", 
  "version": "1.0.0",
  "type": "module",
  "main": "start.mjs",
  "scripts": { "start": "node start.mjs" },
  "dependencies": originalPkg.dependencies
};
fs.writeFileSync('dist/package.json', JSON.stringify(prodPkg, null, 2));

// Create startup script with proper ES module syntax
const startScript = `// Production server startup with ES module compatibility
import { spawn } from 'child_process';

console.log('Starting BeyondAsk production server...');

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';
process.env.HOST = '0.0.0.0';

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Production server error:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Production server rejection:', reason);
  process.exit(1);
});

// Start server with tsx
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '5000',
    HOST: '0.0.0.0'
  },
  cwd: process.cwd()
});

server.on('exit', (code) => {
  console.log('Server process exited with code:', code);
  process.exit(code || 0);
});

server.on('error', (error) => {
  console.error('Server startup error:', error.message);
  process.exit(1);
});

console.log('Production server starting on 0.0.0.0:' + process.env.PORT);
`;

fs.writeFileSync('dist/start.mjs', startScript);

console.log('ES module syntax errors fixed successfully!');
console.log('Fixed TypeScript type imports that cause "Unexpected identifier" errors');
console.log('Production deployment ready in dist/ directory');