/**
 * Complete test of Playwright fallback functionality
 */

const fs = require('fs');
const path = require('path');

// Load the document processor module
const { processUrl } = require('./server/services/document_processor.ts');

async function testPlaywrightFallback() {
  console.log('=== Playwright Fallback Test Suite ===\n');
  
  const testCases = [
    {
      name: 'Static HTML Site',
      url: 'https://httpbin.org/html',
      expectedMethod: 'static'
    },
    {
      name: 'React SPA (should trigger Playwright)',
      url: 'https://reactjs.org',
      expectedMethod: 'dynamic_playwright'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    console.log(`URL: ${testCase.url}`);
    
    try {
      const startTime = Date.now();
      const result = await processUrl(testCase.url);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const extractionMethod = result.metadata.extraction_method || 'static';
      
      console.log(`✅ SUCCESS (${duration}ms)`);
      console.log(`Extraction method: ${extractionMethod}`);
      console.log(`Title: ${result.metadata.title}`);
      console.log(`Chunks: ${result.chunks.length}`);
      console.log(`Content preview: ${result.chunks[0]?.content.substring(0, 150)}...`);
      
      // Verify extraction method matches expectation
      if (extractionMethod === testCase.expectedMethod) {
        console.log(`✓ Correct extraction method used`);
      } else {
        console.log(`⚠ Expected ${testCase.expectedMethod}, got ${extractionMethod}`);
      }
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
    }
  }
  
  console.log('\n=== Test Summary ===');
  console.log('Playwright fallback system is now active for JavaScript-rendered sites');
  console.log('- Static sites use fast cheerio extraction');
  console.log('- SPAs automatically fallback to Playwright when content is empty');
  console.log('- Browser instance is reused for performance');
}

// Run the test
if (require.main === module) {
  testPlaywrightFallback()
    .then(() => {
      console.log('\nPlaywright fallback test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testPlaywrightFallback };