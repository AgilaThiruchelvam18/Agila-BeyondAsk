import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { log } from './vite';
import * as schema from '../shared/schema';

import dotenv from "dotenv";
dotenv.config();

// Get environment-specific PostgreSQL connection string
let DATABASE_URL = '';

if (process.env.NODE_ENV === 'production') {
  DATABASE_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!DATABASE_URL) {
    throw new Error('PROD_DATABASE_URL or DATABASE_URL environment variable is not set for production');
  }
} else {
  // In development, use DATABASE_URL (the current working one)
  DATABASE_URL = process.env.DATABASE_URL || process.env.DEV_DATABASE_URL || '';
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL or DEV_DATABASE_URL environment variable is not set for development');
  }
}

// Create a postgres connection
const queryClient = postgres(DATABASE_URL, { 
  max: 20,              // Maximum connections
  idle_timeout: 20,     // Close idle connections after 20s
  max_lifetime: 1800,   // Maximum connection lifetime (30 min)
  connect_timeout: 60,  // Connection timeout
});

// Create a drizzle instance with our schema 
export const db = drizzle(queryClient, { schema });

export async function connectToDB() {
  try {
    // Just run a simple query to check connection
    await queryClient`SELECT NOW()`;
    log('Connected to PostgreSQL database', 'postgresql');
    return true;
  } catch (err) {
    console.error('Error connecting to PostgreSQL:', err);
    return false;
  }
}

export async function closeConnection() {
  try {
    await queryClient.end();
    log('PostgreSQL connection closed', 'postgresql');
  } catch (err) {
    console.error('Error closing PostgreSQL connection:', err);
  }
}

export default { db, connectToDB, closeConnection };