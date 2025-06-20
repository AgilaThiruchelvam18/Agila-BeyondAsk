/**
 * Integration Management System Test Suite
 * Tests the migrated integration and third-party service routes
 */

import axios from 'axios';

// Test configuration
const testConfig = {
  baseUrl: 'http://localhost:5000/api',
  validToken: 'test-jwt-token-12345',
  testTimeout: 30000
};

/**
 * Make HTTP request with error handling
 */
async function makeRequest(method, endpoint, data = null, token = testConfig.validToken) {
  try {
    const config = {
      method,
      url: `${testConfig.baseUrl}${endpoint}`,
      timeout: testConfig.testTimeout,
      headers: {}
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      error: error.response?.data?.error || error.message,
      data: error.response?.data
    };
  }
}

class IntegrationSystemTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      details: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📝';
    console.log(`[${timestamp}] ${prefix} ${message}`);
    
    if (type === 'error') {
      this.results.failed++;
    } else if (type === 'success') {
      this.results.passed++;
    }
    this.results.total++;
    
    this.results.details.push({ timestamp, type, message });
  }

  async testAuthenticationRequired() {
    this.log('Testing authentication requirements for integration endpoints...');
    
    const protectedEndpoints = [
      { method: 'get', path: '/integrations' },
      { method: 'post', path: '/integrations' },
      { method: 'get', path: '/integrations/1' },
      { method: 'put', path: '/integrations/1' },
      { method: 'delete', path: '/integrations/1' },
      { method: 'post', path: '/integrations/1/test' },
      { method: 'get', path: '/integrations/1/logs' },
      { method: 'patch', path: '/integrations/1/toggle' }
    ];

    for (const endpoint of protectedEndpoints) {
      const result = await makeRequest(endpoint.method, endpoint.path, null, null);
      
      if (result.status === 401) {
        this.log(`✓ ${endpoint.method.toUpperCase()} ${endpoint.path} properly requires authentication`, 'success');
      } else {
        this.log(`✗ ${endpoint.method.toUpperCase()} ${endpoint.path} authentication check failed (status: ${result.status})`, 'error');
      }
    }
  }

  async testIntegrationProviderEndpoints() {
    this.log('Testing integration provider endpoints...');

    // Test get all providers (public endpoint)
    const providersResult = await makeRequest('get', '/integrations/providers', null, null);
    if (providersResult.success) {
      this.log('✓ Get all integration providers endpoint accessible', 'success');
    } else {
      this.log(`✗ Get all integration providers failed: ${providersResult.error}`, 'error');
    }

    // Test get specific provider (public endpoint)
    const providerResult = await makeRequest('get', '/integrations/providers/1', null, null);
    if (providerResult.status === 404 || providerResult.success) {
      this.log('✓ Get specific integration provider endpoint accessible', 'success');
    } else {
      this.log(`✗ Get specific integration provider failed: ${providerResult.error}`, 'error');
    }

    // Test create provider (requires auth)
    const createProviderData = {
      name: 'Test Provider',
      type: 'custom',
      description: 'Test integration provider',
      isEnabled: true
    };
    
    const createResult = await makeRequest('post', '/integrations/providers', createProviderData);
    if (createResult.success || createResult.status === 400) {
      this.log('✓ Create integration provider endpoint accessible with auth', 'success');
    } else {
      this.log(`✗ Create integration provider failed: ${createResult.error}`, 'error');
    }
  }

  async testIntegrationEndpoints() {
    this.log('Testing integration management endpoints...');

    // Test get user integrations
    const integrationsResult = await makeRequest('get', '/integrations');
    if (integrationsResult.success) {
      this.log('✓ Get user integrations endpoint working', 'success');
    } else {
      this.log(`✗ Get user integrations failed: ${integrationsResult.error}`, 'error');
    }

    // Test create integration with invalid data
    const invalidIntegrationData = {
      name: '', // Invalid: empty name
      providerId: 'invalid' // Invalid: not a number
    };
    
    const invalidResult = await makeRequest('post', '/integrations', invalidIntegrationData);
    if (invalidResult.status === 400) {
      this.log('✓ Create integration properly validates input data', 'success');
    } else {
      this.log(`✗ Create integration validation failed (status: ${invalidResult.status})`, 'error');
    }

    // Test create integration with valid data
    const validIntegrationData = {
      providerId: 1,
      name: 'Test Integration',
      description: 'Test integration description',
      config: { testKey: 'testValue' },
      isActive: true
    };
    
    const validResult = await makeRequest('post', '/integrations', validIntegrationData);
    if (validResult.success || validResult.status === 404) { // 404 if provider doesn't exist
      this.log('✓ Create integration endpoint accepts valid data', 'success');
    } else {
      this.log(`✗ Create integration with valid data failed: ${validResult.error}`, 'error');
    }

    // Test get specific integration
    const specificResult = await makeRequest('get', '/integrations/1');
    if (specificResult.success || specificResult.status === 404 || specificResult.status === 403) {
      this.log('✓ Get specific integration endpoint accessible', 'success');
    } else {
      this.log(`✗ Get specific integration failed: ${specificResult.error}`, 'error');
    }

    // Test update integration
    const updateData = {
      name: 'Updated Integration Name',
      description: 'Updated description'
    };
    
    const updateResult = await makeRequest('put', '/integrations/1', updateData);
    if (updateResult.success || updateResult.status === 404 || updateResult.status === 403) {
      this.log('✓ Update integration endpoint accessible', 'success');
    } else {
      this.log(`✗ Update integration failed: ${updateResult.error}`, 'error');
    }

    // Test integration test endpoint
    const testResult = await makeRequest('post', '/integrations/1/test');
    if (testResult.success || testResult.status === 404 || testResult.status === 403) {
      this.log('✓ Test integration endpoint accessible', 'success');
    } else {
      this.log(`✗ Test integration failed: ${testResult.error}`, 'error');
    }

    // Test get integration logs
    const logsResult = await makeRequest('get', '/integrations/1/logs?page=1&limit=10');
    if (logsResult.success || logsResult.status === 404 || logsResult.status === 403) {
      this.log('✓ Get integration logs endpoint accessible', 'success');
    } else {
      this.log(`✗ Get integration logs failed: ${logsResult.error}`, 'error');
    }

    // Test toggle integration
    const toggleResult = await makeRequest('patch', '/integrations/1/toggle');
    if (toggleResult.success || toggleResult.status === 404 || toggleResult.status === 403) {
      this.log('✓ Toggle integration endpoint accessible', 'success');
    } else {
      this.log(`✗ Toggle integration failed: ${toggleResult.error}`, 'error');
    }

    // Test delete integration
    const deleteResult = await makeRequest('delete', '/integrations/1');
    if (deleteResult.success || deleteResult.status === 404 || deleteResult.status === 403) {
      this.log('✓ Delete integration endpoint accessible', 'success');
    } else {
      this.log(`✗ Delete integration failed: ${deleteResult.error}`, 'error');
    }
  }

  async testInputValidation() {
    this.log('Testing input validation for integration endpoints...');

    // Test invalid provider ID
    const invalidProviderResult = await makeRequest('get', '/integrations/providers/invalid');
    if (invalidProviderResult.status === 400) {
      this.log('✓ Provider endpoint validates numeric IDs', 'success');
    } else {
      this.log(`✗ Provider ID validation failed (status: ${invalidProviderResult.status})`, 'error');
    }

    // Test invalid integration ID
    const invalidIntegrationResult = await makeRequest('get', '/integrations/invalid');
    if (invalidIntegrationResult.status === 400) {
      this.log('✓ Integration endpoint validates numeric IDs', 'success');
    } else {
      this.log(`✗ Integration ID validation failed (status: ${invalidIntegrationResult.status})`, 'error');
    }

    // Test create integration with missing required fields
    const missingFieldsData = {
      description: 'Missing required fields'
      // Missing: providerId, name
    };
    
    const missingFieldsResult = await makeRequest('post', '/integrations', missingFieldsData);
    if (missingFieldsResult.status === 400) {
      this.log('✓ Create integration validates required fields', 'success');
    } else {
      this.log(`✗ Required fields validation failed (status: ${missingFieldsResult.status})`, 'error');
    }

    // Test create provider with invalid type
    const invalidTypeData = {
      name: 'Test Provider',
      type: 'invalid_type', // Invalid enum value
      description: 'Test provider'
    };
    
    const invalidTypeResult = await makeRequest('post', '/integrations/providers', invalidTypeData);
    if (invalidTypeResult.status === 400) {
      this.log('✓ Create provider validates enum types', 'success');
    } else {
      this.log(`✗ Provider type validation failed (status: ${invalidTypeResult.status})`, 'error');
    }
  }

  async testErrorHandling() {
    this.log('Testing error handling for integration endpoints...');

    // Test non-existent provider
    const nonExistentProvider = await makeRequest('get', '/integrations/providers/999999');
    if (nonExistentProvider.status === 404) {
      this.log('✓ Properly handles non-existent provider requests', 'success');
    } else {
      this.log(`✗ Non-existent provider handling failed (status: ${nonExistentProvider.status})`, 'error');
    }

    // Test non-existent integration
    const nonExistentIntegration = await makeRequest('get', '/integrations/999999');
    if (nonExistentIntegration.status === 404 || nonExistentIntegration.status === 403) {
      this.log('✓ Properly handles non-existent integration requests', 'success');
    } else {
      this.log(`✗ Non-existent integration handling failed (status: ${nonExistentIntegration.status})`, 'error');
    }

    // Test malformed JSON
    try {
      const malformedResult = await axios.post(`${testConfig.baseUrl}/integrations`, 'invalid-json', {
        headers: {
          'Authorization': `Bearer ${testConfig.validToken}`,
          'Content-Type': 'application/json'
        },
        timeout: testConfig.testTimeout
      });
      this.log('✗ Should have rejected malformed JSON', 'error');
    } catch (error) {
      if (error.response?.status === 400) {
        this.log('✓ Properly rejects malformed JSON', 'success');
      } else {
        this.log(`✗ Malformed JSON handling unexpected (status: ${error.response?.status})`, 'error');
      }
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Integration Management System Tests...');
    this.log(`Testing against: ${testConfig.baseUrl}`);
    
    try {
      await this.testAuthenticationRequired();
      await this.testIntegrationProviderEndpoints();
      await this.testIntegrationEndpoints();
      await this.testInputValidation();
      await this.testErrorHandling();
      
      this.log('📊 Test Summary:');
      this.log(`Total tests: ${this.results.total}`);
      this.log(`Passed: ${this.results.passed}`);
      this.log(`Failed: ${this.results.failed}`);
      this.log(`Success rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
      
      if (this.results.failed === 0) {
        this.log('🎉 All Integration Management tests passed!', 'success');
      } else {
        this.log('⚠️ Some Integration Management tests failed. Check the details above.', 'error');
      }
      
    } catch (error) {
      this.log(`Fatal error during testing: ${error.message}`, 'error');
    }
  }
}

// Run tests if this file is executed directly
const tester = new IntegrationSystemTester();
tester.runAllTests().catch(console.error);