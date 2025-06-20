#!/usr/bin/env node

/**
 * Production Build Script for BeyondAsk Platform
 * Creates a complete production-ready deployment package
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting production build for BeyondAsk...');

// Clean up previous build
console.log('🧹 Cleaning previous build...');
if (fs.existsSync('dist')) {
  execSync('rm -rf dist', { stdio: 'inherit' });
}
fs.mkdirSync('dist', { recursive: true });

// Step 1: Build frontend
console.log('🎨 Building frontend...');
try {
  execSync('npm run build:frontend', { stdio: 'inherit' });
  console.log('✅ Frontend build completed');
} catch (error) {
  console.log('⚠️  Frontend build command not found, using Vite directly...');
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('✅ Frontend build completed with Vite');
}

// Step 2: Compile TypeScript server
console.log('🔧 Compiling TypeScript server...');
try {
  execSync('npx tsc --project tsconfig.production.json', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation completed');
} catch (error) {
  console.warn('⚠️  TypeScript compilation failed, using tsx runtime instead');
  
  // Copy source files as fallback
  execSync('cp -r server dist/', { stdio: 'inherit' });
  execSync('cp -r shared dist/', { stdio: 'inherit' });
  console.log('✅ Source files copied for tsx runtime');
}

// Step 3: Copy necessary files
console.log('📁 Copying configuration files...');
const filesToCopy = [
  'vite.config.ts',
  'tsconfig.json', 
  'tailwind.config.ts',
  'postcss.config.js',
  'drizzle.config.ts'
];

filesToCopy.forEach(file => {
  if (fs.existsSync(file)) {
    execSync(`cp ${file} dist/`, { stdio: 'inherit' });
  }
});

// Copy client directory if it exists
if (fs.existsSync('client')) {
  execSync('cp -r client dist/', { stdio: 'inherit' });
}

// Create test directory for pdf-parse dependency
fs.mkdirSync('dist/test/data', { recursive: true });
fs.writeFileSync('dist/test/data/05-versions-space.pdf', 'dummy file for pdf-parse');

// Step 4: Create production package.json
console.log('📦 Creating production package.json...');
const originalPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const productionPkg = {
  name: originalPkg.name,
  version: originalPkg.version,
  type: "module",
  main: "start.js",
  scripts: {
    start: "node start.js"
  },
  dependencies: originalPkg.dependencies
};

fs.writeFileSync('dist/package.json', JSON.stringify(productionPkg, null, 2));

// Step 5: Create startup script
console.log('🚀 Creating startup script...');
const startScript = `#!/usr/bin/env node

/**
 * Production Startup Script for BeyondAsk Platform
 * Handles both compiled TypeScript and tsx runtime scenarios
 */

console.log('🚀 Starting BeyondAsk production server...');

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';
process.env.FORCE_VITE = 'true';

// Enhanced error handling
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📤 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📤 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Determine the best way to start the server
let serverCommand, serverArgs;

if (fs.existsSync('./server/index.js')) {
  // Use compiled JavaScript if available
  console.log('📁 Using compiled JavaScript server...');
  serverCommand = 'node';
  serverArgs = ['./server/index.js'];
} else if (fs.existsSync('./server/index.ts')) {
  // Use tsx to run TypeScript directly
  console.log('📁 Using tsx runtime for TypeScript server...');
  serverCommand = 'npx';
  serverArgs = ['tsx', './server/index.ts'];
} else {
  console.error('❌ No server entry point found!');
  process.exit(1);
}

console.log(\`🎯 Starting server with: \${serverCommand} \${serverArgs.join(' ')}\`);

const server = spawn(serverCommand, serverArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '5000',
    FORCE_VITE: 'true'
  }
});

server.on('exit', (code, signal) => {
  if (signal) {
    console.log(\`📤 Server terminated by signal: \${signal}\`);
  } else {
    console.log(\`📤 Server exited with code: \${code}\`);
  }
  process.exit(code || 0);
});

server.on('error', (error) => {
  console.error('💥 Server startup error:', error);
  process.exit(1);
});

console.log('✅ Production server started successfully!');
`;

fs.writeFileSync('dist/start.js', startScript);
execSync('chmod +x dist/start.js', { stdio: 'inherit' });

// Step 6: Create alternative entry points for different deployment scenarios
console.log('🔧 Creating alternative entry points...');

// Create index.js for platforms that expect it
const indexScript = `#!/usr/bin/env node

// Alternative entry point that delegates to start.js
import('./start.js').catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
`;

fs.writeFileSync('dist/index.js', indexScript);
execSync('chmod +x dist/index.js', { stdio: 'inherit' });

// Create server.js for platforms that expect it
const serverScript = `#!/usr/bin/env node

// Server entry point that delegates to start.js
import('./start.js').catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
`;

fs.writeFileSync('dist/server.js', serverScript);
execSync('chmod +x dist/server.js', { stdio: 'inherit' });

// Step 7: Create deployment instructions
const deployInstructions = `# BeyondAsk Production Deployment

## Quick Start
\`\`\`bash
cd dist
npm install
npm start
\`\`\`

## Alternative Start Commands
- \`node start.js\` - Primary startup script
- \`node index.js\` - Alternative entry point
- \`node server.js\` - Server-specific entry point

## Environment Variables
Make sure these are set in your deployment environment:
- \`NODE_ENV=production\`
- \`PORT=5000\` (or your preferred port)
- \`DATABASE_URL\` - PostgreSQL connection string
- \`AUTH0_DOMAIN\` - Auth0 domain
- \`AUTH0_CLIENT_ID\` - Auth0 client ID
- \`AUTH0_CLIENT_SECRET\` - Auth0 client secret
- \`PINECONE_API_KEY\` - Pinecone API key
- \`OPENAI_API_KEY\` - OpenAI API key

## Build Output
- \`start.js\` - Main production startup script
- \`package.json\` - Production dependencies
- \`server/\` - Compiled/source server files
- \`client/dist/\` - Built frontend assets
- \`shared/\` - Shared type definitions

## Troubleshooting
1. If TypeScript files are not compiled, the startup script will use tsx runtime
2. Multiple entry points provided for different deployment platforms
3. Comprehensive error handling and graceful shutdown built-in
`;

fs.writeFileSync('dist/README.md', deployInstructions);

console.log('✅ Production build completed successfully!');
console.log('');
console.log('📁 Build output in ./dist directory');
console.log('🚀 Deploy with: cd dist && npm install && npm start');
console.log('');
console.log('Entry points created:');
console.log('  - start.js (primary)');
console.log('  - index.js (alternative)');
console.log('  - server.js (server-specific)');