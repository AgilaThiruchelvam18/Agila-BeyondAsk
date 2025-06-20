/**
 * Document Processing Service
 * 
 * This service handles the processing of various document types:
 * - Plain text
 * - PDF documents
 * - URLs with web content
 * 
 * It converts documents into chunks appropriate for embedding.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pdfParse from 'pdf-parse';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// Create uploads directory if it doesn't exist
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Browser instance management for Playwright
let browserInstance: Browser | null = null;

async function getBrowserInstance(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
  }
  return browserInstance;
}

async function closeBrowserInstance(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// Graceful shutdown
process.on('SIGINT', closeBrowserInstance);
process.on('SIGTERM', closeBrowserInstance);

// Define interfaces for document processing
export interface DocumentChunk {
  content: string;
  metadata: {
    source: string;
    chunk_index: number;
    total_chunks: number;
    [key: string]: any; // Additional metadata
  };
}

export interface ProcessedDocument {
  chunks: DocumentChunk[];
  metadata: {
    title?: string;
    source_type: 'text' | 'pdf' | 'url';
    source_url?: string;
    filename?: string;
    created_at: Date;
    total_chunks: number;
    [key: string]: any; // Additional metadata
  };
}

/**
 * Process plain text into chunks
 * 
 * @param text The text content to process
 * @param source Identifier for the source of this text
 * @param metadata Additional metadata to include
 * @param chunkSize Maximum size of each chunk (in characters)
 * @param chunkOverlap Number of characters to overlap between chunks
 * @returns Processed document with chunks
 */
export async function processText(
  text: string, 
  source: string, 
  metadata: Record<string, any> = {},
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<ProcessedDocument> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text content is empty');
  }

  console.log(`Processing text from ${source}, length: ${text.length} characters`);
  
  // Clean the text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Split text into chunks
  const chunks: DocumentChunk[] = [];
  let index = 0;

  while (index < cleanedText.length) {
    // Move start position backward to account for overlap, but not beyond 0
    const startPosition = index === 0 ? 0 : index - chunkOverlap;
    
    // Calculate the approximate ending position of the chunk
    const endPosition = Math.min(startPosition + chunkSize, cleanedText.length);
    
    // If we're not at the end of the text, try to find a good breakpoint
    let adjustedEndPosition = endPosition;
    if (endPosition < cleanedText.length) {
      // Look for natural break points: paragraph, sentence, or word boundary
      const paragraphBreak = cleanedText.indexOf('\n\n', endPosition - 100);
      const sentenceBreak = cleanedText.indexOf('. ', endPosition - 100);
      const wordBreak = cleanedText.indexOf(' ', endPosition - 20);
      
      if (paragraphBreak !== -1 && paragraphBreak < endPosition + 100) {
        adjustedEndPosition = paragraphBreak + 2; // Include the newlines
      } else if (sentenceBreak !== -1 && sentenceBreak < endPosition + 50) {
        adjustedEndPosition = sentenceBreak + 2; // Include the period and space
      } else if (wordBreak !== -1 && wordBreak < endPosition + 20) {
        adjustedEndPosition = wordBreak + 1; // Include the space
      }
    }
    
    // Extract the chunk
    const chunkText = cleanedText.substring(startPosition, adjustedEndPosition);
    
    // Add chunk if it's not just whitespace
    if (chunkText.trim().length > 0) {
      chunks.push({
        content: chunkText,
        metadata: {
          source,
          chunk_index: chunks.length,
          total_chunks: -1, // Will be updated at the end
          ...metadata
        }
      });
    }
    
    // Move index to the adjusted end position
    index = adjustedEndPosition;
  }
  
  // Update total_chunks in metadata
  chunks.forEach(chunk => {
    chunk.metadata.total_chunks = chunks.length;
  });
  
  return {
    chunks,
    metadata: {
      source_type: 'text',
      created_at: new Date(),
      total_chunks: chunks.length,
      ...metadata
    }
  };
}

/**
 * Process a PDF file into chunks of text
 * 
 * @param fileBuffer Buffer containing the PDF file
 * @param filename Name of the PDF file
 * @param metadata Additional metadata for the document
 * @param chunkSize Maximum size of each chunk (in characters)
 * @param chunkOverlap Number of characters to overlap between chunks
 * @returns Processed document with chunks
 */
export async function processPdf(
  fileBuffer: Buffer,
  filename: string,
  metadata: Record<string, any> = {},
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<ProcessedDocument> {
  console.log(`Processing PDF: ${filename}, size: ${fileBuffer.length} bytes`);
  
  try {
    // Parse PDF
    const pdfData = await pdfParse(fileBuffer);
    const { text, info, metadata: pdfMetadata, numPages } = pdfData;
    
    // Extract a title from the PDF if possible
    const title = pdfMetadata?.info?.Title || filename;
    
    // Add PDF-specific metadata
    const enrichedMetadata = {
      ...metadata,
      filename,
      title,
      pages: numPages,
      pdf_info: info,
      pdf_metadata: pdfMetadata
    };
    
    // Process the extracted text
    const source = `pdf:${filename}`;
    const processedDoc = await processText(text, source, enrichedMetadata, chunkSize, chunkOverlap);
    
    // Update the source type
    processedDoc.metadata.source_type = 'pdf';
    return processedDoc;
  } catch (error: unknown) {
    console.error('Error processing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to process PDF: ${errorMessage}`);
  }
}

/**
 * Check if a website appears to be a Single Page Application
 */
function detectSPA(html: string): boolean {
  const spaIndicators = [
    '<div id="root">',
    '<div id="app">',
    'react',
    'vue',
    'angular',
    'data-vite-theme',
    'type="module"'
  ];
  
  const lowerHtml = html.toLowerCase();
  return spaIndicators.some(indicator => lowerHtml.includes(indicator));
}

/**
 * Process URL with static content extraction (fast method)
 */
async function processUrlStatic(
  url: string,
  metadata: Record<string, any> = {},
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<ProcessedDocument> {
  console.log(`Processing URL statically: ${url}`);
  
  // Fetch the URL content
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  });
  
  const html = response.data;
  
  // Parse HTML
  const $ = cheerio.load(html);
  
  // Remove unwanted elements
  $('script, style, nav, footer, iframe, noscript, head').remove();
  
  // Extract title
  const title = $('title').text().trim() || url;
  
  // Get all paragraphs and headings
  const mainContent: string[] = [];
  $('p, h1, h2, h3, h4, h5, h6, article, section, main, div > p').each((_, element) => {
    const text = $(element).text().trim();
    if (text.length > 0) {
      mainContent.push(text);
    }
  });
  
  // Combine the text
  const extractedText = mainContent.join('\n\n');
  
  // Check if content is empty and if it's a SPA
  if (!extractedText.trim() && detectSPA(html)) {
    throw new Error('SPA_DETECTED');
  }
  
  // Add URL-specific metadata
  const enrichedMetadata = {
    ...metadata,
    url,
    title,
    html_size: html.length,
    extraction_method: 'static'
  };
  
  // Process the extracted text
  const processedDoc = await processText(extractedText, url, enrichedMetadata, chunkSize, chunkOverlap);
  
  // Update the source type
  processedDoc.metadata.source_type = 'url';
  processedDoc.metadata.source_url = url;
  
  return processedDoc;
}

/**
 * Process URL with dynamic content extraction using Playwright (for SPAs)
 */
async function processUrlDynamic(
  url: string,
  metadata: Record<string, any> = {},
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<ProcessedDocument> {
  console.log(`Processing URL dynamically with Playwright: ${url}`);
  
  const browser = await getBrowserInstance();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Set reasonable timeouts
    page.setDefaultTimeout(30000);
    
    // Block unnecessary resources for faster loading
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Wait for content to load (try multiple strategies)
    try {
      // Wait for common content selectors
      await page.waitForSelector('body', { timeout: 5000 });
      
      // Wait a bit more for dynamic content
      await page.waitForTimeout(3000);
      
      // Try to wait for specific content indicators
      await Promise.race([
        page.waitForSelector('p, h1, h2, h3, article, main', { timeout: 5000 }),
        page.waitForTimeout(5000)
      ]);
    } catch (waitError) {
      console.log('Wait timeout, proceeding with available content');
    }
    
    // Extract title
    const title = await page.title() || url;
    
    // Extract text content from the page
    const extractedText = await page.evaluate(() => {
      // Remove unwanted elements
      const elementsToRemove = document.querySelectorAll('script, style, nav, footer, iframe, noscript, head');
      elementsToRemove.forEach(el => el.remove());
      
      // Get text from main content areas
      const contentSelectors = [
        'main', 'article', '[role="main"]',
        'h1, h2, h3, h4, h5, h6',
        'p', 'div > p',
        'section', '.content', '#content',
        '[class*="content"]', '[class*="article"]',
        '[class*="post"]', '[class*="text"]'
      ];
      
      const textParts: string[] = [];
      
      for (const selector of contentSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const text = element.textContent?.trim();
          if (text && text.length > 20 && !textParts.includes(text)) {
            textParts.push(text);
          }
        });
      }
      
      return textParts.join('\n\n');
    });
    
    // Add URL-specific metadata
    const enrichedMetadata = {
      ...metadata,
      url,
      title,
      extraction_method: 'dynamic_playwright'
    };
    
    // Process the extracted text
    const processedDoc = await processText(extractedText, url, enrichedMetadata, chunkSize, chunkOverlap);
    
    // Update the source type
    processedDoc.metadata.source_type = 'url';
    processedDoc.metadata.source_url = url;
    
    return processedDoc;
  } finally {
    await context.close();
  }
}

/**
 * Process a URL by scraping the content and extracting text
 * Uses static extraction first, falls back to dynamic extraction for SPAs
 * 
 * @param url The URL to scrape
 * @param metadata Additional metadata for the document
 * @param chunkSize Maximum size of each chunk (in characters)
 * @param chunkOverlap Number of characters to overlap between chunks
 * @returns Processed document with chunks
 */
export async function processUrl(
  url: string,
  metadata: Record<string, any> = {},
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<ProcessedDocument> {
  console.log(`Processing URL: ${url}`);
  
  try {
    // First attempt: Fast static scraping
    return await processUrlStatic(url, metadata, chunkSize, chunkOverlap);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // If static extraction failed due to empty content or SPA detection, try dynamic extraction
    if (errorMessage.includes('Text content is empty') || errorMessage.includes('SPA_DETECTED')) {
      console.log(`Static extraction failed, trying dynamic extraction for: ${url}`);
      try {
        return await processUrlDynamic(url, metadata, chunkSize, chunkOverlap);
      } catch (dynamicError: unknown) {
        const dynamicErrorMessage = dynamicError instanceof Error ? dynamicError.message : String(dynamicError);
        throw new Error(`Both static and dynamic extraction failed: ${dynamicErrorMessage}`);
      }
    }
    
    // For other errors, throw the original error
    throw new Error(`Failed to process URL: ${errorMessage}`);
  }
}

/**
 * Save an uploaded file to disk
 * 
 * @param buffer File buffer
 * @param filename Original filename
 * @returns Path to the saved file
 */
export async function saveUploadedFile(buffer: Buffer, filename: string): Promise<string> {
  // Generate a unique filename
  const uniqueFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, uniqueFilename);
  
  // Write the file
  const writeFile = promisify(fs.writeFile);
  await writeFile(filePath, buffer);
  
  return filePath;
}

/**
 * Delete a file from disk
 * 
 * @param filePath Path to the file
 */
export async function deleteFile(filePath: string): Promise<void> {
  const unlink = promisify(fs.unlink);
  try {
    await unlink(filePath);
  } catch (error: unknown) {
    console.error(`Error deleting file ${filePath}:`, error);
  }
}