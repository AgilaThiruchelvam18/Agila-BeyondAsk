/**
 * Test script to verify Playwright fallback for JavaScript-rendered content
 */

const { processUrl } = require('./server/services/document_processor');

async function testPlaywrightFallback() {
  console.log('Testing Playwright fallback functionality...\n');
  
  // Test cases: Static site vs SPA
  const testUrls = [
    { 
      url: 'https://example.com', 
      description: 'Static HTML site (should use static extraction)'
    },
    { 
      url: 'https://beyondask.com', 
      description: 'React SPA (should fallback to Playwright)'
    }
  ];
  
  for (const testCase of testUrls) {
    console.log(`\n--- Testing: ${testCase.description} ---`);
    console.log(`URL: ${testCase.url}`);
    
    try {
      const startTime = Date.now();
      const result = await processUrl(testCase.url);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ SUCCESS (${duration}ms)`);
      console.log(`Extraction method: ${result.metadata.extraction_method || 'static'}`);
      console.log(`Title: ${result.metadata.title}`);
      console.log(`Chunks generated: ${result.chunks.length}`);
      console.log(`Content preview: ${result.chunks[0]?.content.substring(0, 100)}...`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
    }
  }
  
  console.log('\n--- Test completed ---');
}

// Run the test
testPlaywrightFallback()
  .then(() => {
    console.log('All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });