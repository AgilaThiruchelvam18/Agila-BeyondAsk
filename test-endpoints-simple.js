/**
 * Simple endpoint validation test for backward compatibility
 * Tests that all new endpoints are properly registered and accessible
 */

const BASE_URL = 'http://localhost:5000';

async function testEndpoint(method, path, expectedStatus = 401) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`${method} ${path}: ${response.status} ${response.ok ? '✅' : response.status === expectedStatus ? '✅' : '❌'}`);
    return response.status === expectedStatus;
  } catch (error) {
    console.log(`${method} ${path}: ERROR - ${error.message} ❌`);
    return false;
  }
}

async function validateEndpoints() {
  console.log('🔍 Testing Backward Compatibility Endpoints...\n');
  
  const tests = [
    // Existing endpoints
    ['GET', '/api/knowledge-bases', 401],
    ['POST', '/api/knowledge-bases', 401],
    ['GET', '/api/knowledge-bases/1', 401],
    ['PUT', '/api/knowledge-bases/1', 401],
    ['DELETE', '/api/knowledge-bases/1', 401],
    
    // NEW backward compatibility endpoints
    ['PATCH', '/api/knowledge-bases/1', 401], // ✅ NEW: PATCH method
    ['GET', '/api/knowledge-bases/1/agents', 401], // ✅ NEW: Agents association
    ['GET', '/api/knowledge-bases/1/dependencies', 401], // ✅ NEW: Dependencies check
    ['DELETE', '/api/knowledge-bases/1/cascade', 401], // ✅ NEW: Cascade delete
    
    // Existing endpoints for completeness
    ['GET', '/api/knowledge-bases/1/stats', 401],
    ['POST', '/api/knowledge-bases/1/share', 401],
    ['GET', '/api/knowledge-bases/1/shares', 401],
    ['GET', '/api/predefined-agents', 200], // Public endpoint
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const [method, path, expectedStatus] of tests) {
    const success = await testEndpoint(method, path, expectedStatus);
    if (success) passed++;
  }
  
  console.log(`\n📊 Results: ${passed}/${total} endpoints validated (${Math.round(passed/total*100)}%)`);
  
  if (passed === total) {
    console.log('🎉 All backward compatibility endpoints are properly registered!');
    console.log('✅ PATCH, agents, dependencies, and cascade delete endpoints implemented');
  } else {
    console.log('⚠️  Some endpoints may not be properly registered');
  }
  
  return passed === total;
}

// Auto-run
validateEndpoints().catch(console.error);