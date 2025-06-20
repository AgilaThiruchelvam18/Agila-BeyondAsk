import express, { Express } from "express";
import path from "path";
import fs from "fs";

/**
 * Configure static file middleware
 * This middleware will serve static files from the public directory
 */
export function setupStaticFileMiddleware(app: Express) {
  const publicDir = path.join(process.cwd(), "public");
  
  // Check if public directory exists
  if (!fs.existsSync(publicDir)) {
    console.warn(`Public directory not found at ${publicDir}, creating it`);
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Register the static middleware
  app.use(express.static(publicDir));
  
  console.log(`Static file middleware configured to serve files from ${publicDir}`);
}