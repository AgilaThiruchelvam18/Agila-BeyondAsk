/**
 * Simple test for Playwright fallback functionality
 */

async function testPlaywright() {
  try {
    const { processUrl } = await import('./server/services/document_processor.js');
    
    console.log('Testing Playwright fallback with https://example.com...');
    const result = await processUrl('https://example.com');
    
    console.log('SUCCESS!');
    console.log('Extraction method:', result.metadata.extraction_method || 'static');
    console.log('Title:', result.metadata.title);
    console.log('Chunks:', result.chunks.length);
    console.log('Content preview:', result.chunks[0]?.content.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPlaywright();