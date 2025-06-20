/**
 * Fix Stuck Documents Script
 * Processes all documents stuck in "processing" status
 */

import { DocumentProcessor } from './server/services/document-processor.js';

async function fixStuckDocuments() {
  console.log('Starting stuck document recovery...');
  
  try {
    await DocumentProcessor.processPendingDocuments();
    console.log('Stuck document recovery completed successfully!');
  } catch (error) {
    console.error('Error during stuck document recovery:', error);
  }
}

fixStuckDocuments();