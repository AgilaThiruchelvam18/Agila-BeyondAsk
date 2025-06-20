#!/usr/bin/env node

// Simplified build script for reliable deployment
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Starting simplified production build...');

// Clean dist directory
console.log('Cleaning dist directory...');
try {
  if (fs.existsSync('dist')) {
    execSync('rm -rf dist');
  }
  fs.mkdirSync('dist', { recursive: true });
  fs.mkdirSync(path.join('dist', 'public'), { recursive: true });
} catch (error) {
  console.error('Error cleaning dist directory:', error.message);
  process.exit(1);
}

// Build frontend
console.log('Building frontend...');
try {
  execSync('vite build --outDir dist/public', { stdio: 'inherit' });
  console.log('Frontend build completed');
} catch (error) {
  console.error('Frontend build failed:', error.message);
  process.exit(1);
}

// Build server with esbuild for reliable compilation
console.log('Building server...');
try {
  const buildCommand = `npx esbuild server/index.ts --bundle --platform=node --target=node18 --outfile=dist/index.js --format=esm --external:@neondatabase/serverless --external:@pinecone-database/pinecone --external:openai --external:@anthropic-ai/sdk --external:axios --external:cheerio --external:multer --external:pdf-parse --external:ws --external:pg --external:mongodb --external:@sendgrid/mail --external:nodemailer --external:express --external:cors --external:dotenv --external:jsonwebtoken --external:bcryptjs --external:drizzle-orm --external:postgres --external:crypto --external:fs --external:path --external:url --external:child_process --external:http --external:net --external:os --external:process --external:util --external:events --external:stream --external:buffer --external:zlib --external:querystring`;
  
  execSync(buildCommand, { stdio: 'inherit' });
  console.log('Server build completed');
} catch (error) {
  console.error('Server build failed:', error.message);
  process.exit(1);
}

// Verify build output
if (!fs.existsSync(path.join('dist', 'index.js'))) {
  console.error('Build failed: index.js was not generated');
  process.exit(1);
}

console.log('Build completed successfully!');
console.log('To start the production server, run: NODE_ENV=production node dist/index.js');