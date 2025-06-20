/**
 * User Domain Optimization Test
 * Tests the new optimized user operations with proper error handling and validation
 */

const TEST_CONFIG = {
  baseUrl: 'http://localhost:5000',
  testUser: {
    authId: 'test_auth_' + Date.now(),
    email: 'test_user_' + Date.now() + '@example.com',
    name: 'Test User Optimized',
    picture: 'https://example.com/avatar.jpg'
  }
};

async function makeRequest(method, endpoint, data = null, token = null) {
  const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const responseData = await response.text();
    
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = responseData;
    }

    return {
      status: response.status,
      data: parsedData,
      success: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      success: false
    };
  }
}

class UserDomainTester {
  constructor() {
    this.testResults = [];
    this.createdUserId = null;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logEntry);
  }

  addTestResult(test, passed, details = '') {
    this.testResults.push({ test, passed, details });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    this.log(`${status}: ${test} ${details ? '- ' + details : ''}`, passed ? 'success' : 'error');
  }

  async testUserCreation() {
    this.log('Testing optimized user creation with validation...');
    
    // Test 1: Create valid user
    const createResponse = await makeRequest('POST', '/api/users', TEST_CONFIG.testUser);
    
    if (createResponse.success && createResponse.data.id) {
      this.createdUserId = createResponse.data.id;
      this.addTestResult(
        'User Creation (Valid Data)', 
        true, 
        `Created user ID: ${this.createdUserId}`
      );
    } else {
      this.addTestResult(
        'User Creation (Valid Data)', 
        false, 
        `Failed: ${JSON.stringify(createResponse.data)}`
      );
      return;
    }

    // Test 2: Try to create duplicate user (should fail with validation)
    const duplicateResponse = await makeRequest('POST', '/api/users', TEST_CONFIG.testUser);
    
    this.addTestResult(
      'User Creation (Duplicate Email)', 
      !duplicateResponse.success && duplicateResponse.status === 409,
      duplicateResponse.success ? 'Should have failed with validation error' : 'Correctly rejected duplicate'
    );

    // Test 3: Try to create user with invalid data
    const invalidUser = { email: 'invalid-email', name: '' };
    const invalidResponse = await makeRequest('POST', '/api/users', invalidUser);
    
    this.addTestResult(
      'User Creation (Invalid Data)', 
      !invalidResponse.success,
      invalidResponse.success ? 'Should have failed validation' : 'Correctly rejected invalid data'
    );
  }

  async testUserRetrieval() {
    this.log('Testing optimized user retrieval methods...');
    
    if (!this.createdUserId) {
      this.addTestResult('User Retrieval Tests', false, 'No user ID available from creation test');
      return;
    }

    // Test 1: Get user by ID
    const getUserResponse = await makeRequest('GET', `/api/users/${this.createdUserId}`);
    this.addTestResult(
      'Get User by ID', 
      getUserResponse.success && getUserResponse.data.id === this.createdUserId,
      getUserResponse.success ? 'User retrieved successfully' : 'Failed to retrieve user'
    );

    // Test 2: Get user by email
    const getUserByEmailResponse = await makeRequest('GET', `/api/users/email/${TEST_CONFIG.testUser.email}`);
    this.addTestResult(
      'Get User by Email', 
      getUserByEmailResponse.success && getUserByEmailResponse.data.email === TEST_CONFIG.testUser.email,
      getUserByEmailResponse.success ? 'User found by email' : 'Failed to find user by email'
    );

    // Test 3: Get user by authId
    const getUserByAuthResponse = await makeRequest('GET', `/api/users/auth/${TEST_CONFIG.testUser.authId}`);
    this.addTestResult(
      'Get User by AuthID', 
      getUserByAuthResponse.success && getUserByAuthResponse.data.authId === TEST_CONFIG.testUser.authId,
      getUserByAuthResponse.success ? 'User found by authId' : 'Failed to find user by authId'
    );

    // Test 4: Get non-existent user (should return 404)
    const getNonExistentResponse = await makeRequest('GET', '/api/users/99999');
    this.addTestResult(
      'Get Non-existent User', 
      getNonExistentResponse.status === 404,
      getNonExistentResponse.status === 404 ? 'Correctly returned 404' : 'Should return 404 for non-existent user'
    );
  }

  async testUserUpdate() {
    this.log('Testing optimized user update with validation...');
    
    if (!this.createdUserId) {
      this.addTestResult('User Update Tests', false, 'No user ID available');
      return;
    }

    // Test 1: Valid update
    const updateData = { name: 'Updated Test User', picture: 'https://example.com/new-avatar.jpg' };
    const updateResponse = await makeRequest('PUT', `/api/users/${this.createdUserId}`, updateData);
    
    this.addTestResult(
      'User Update (Valid Data)', 
      updateResponse.success && updateResponse.data.name === updateData.name,
      updateResponse.success ? 'User updated successfully' : 'Failed to update user'
    );

    // Test 2: Try to update with conflicting email
    const conflictData = { email: 'conflict@example.com' };
    
    // First create another user with this email
    const tempUser = {
      authId: 'temp_auth_' + Date.now(),
      email: 'conflict@example.com',
      name: 'Temp User'
    };
    await makeRequest('POST', '/api/users', tempUser);
    
    // Now try to update our test user with the same email
    const conflictResponse = await makeRequest('PUT', `/api/users/${this.createdUserId}`, conflictData);
    
    this.addTestResult(
      'User Update (Email Conflict)', 
      !conflictResponse.success,
      conflictResponse.success ? 'Should have failed with email conflict' : 'Correctly rejected email conflict'
    );

    // Test 3: Update non-existent user
    const updateNonExistentResponse = await makeRequest('PUT', '/api/users/99999', updateData);
    this.addTestResult(
      'Update Non-existent User', 
      updateNonExistentResponse.status === 404,
      updateNonExistentResponse.status === 404 ? 'Correctly returned 404' : 'Should return 404'
    );
  }

  async testErrorHandling() {
    this.log('Testing optimized error handling and logging...');
    
    // Test 1: Invalid ID format
    const invalidIdResponse = await makeRequest('GET', '/api/users/invalid-id');
    this.addTestResult(
      'Invalid ID Format', 
      !invalidIdResponse.success,
      'Should handle invalid ID format gracefully'
    );

    // Test 2: Missing required fields
    const missingFieldsResponse = await makeRequest('POST', '/api/users', { email: 'test@example.com' });
    this.addTestResult(
      'Missing Required Fields', 
      !missingFieldsResponse.success,
      'Should validate required fields'
    );
  }

  async runAllTests() {
    this.log('🚀 Starting User Domain Optimization Tests');
    
    try {
      await this.testUserCreation();
      await this.testUserRetrieval();
      await this.testUserUpdate();
      await this.testErrorHandling();
      
      const passedTests = this.testResults.filter(r => r.passed).length;
      const totalTests = this.testResults.length;
      
      this.log(`\n📊 Test Results Summary:`);
      this.log(`Total Tests: ${totalTests}`);
      this.log(`Passed: ${passedTests}`);
      this.log(`Failed: ${totalTests - passedTests}`);
      this.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
      
      if (passedTests === totalTests) {
        this.log('🎉 All User Domain Tests Passed! Optimization is working correctly.');
      } else {
        this.log('⚠️  Some tests failed. Check the detailed results above.');
      }
      
    } catch (error) {
      this.log(`❌ Test suite failed with error: ${error.message}`, 'error');
    }
  }
}

// Run the tests
const tester = new UserDomainTester();
tester.runAllTests().catch(console.error);