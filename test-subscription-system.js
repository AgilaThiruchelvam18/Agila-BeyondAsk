/**
 * Subscription Management System Test Suite
 * Tests the migrated subscription, billing, and payment processing routes
 */

const testConfig = {
  baseUrl: 'http://localhost:5000',
  // Using a test token - in real scenario this would be obtained through proper authentication
  validToken: 'test-auth-token-12345',
  timeout: 10000
};

/**
 * Make HTTP request with error handling
 */
async function makeRequest(method, endpoint, data = null, token = testConfig.validToken) {
  const url = `${testConfig.baseUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    ...(data && { body: JSON.stringify(data) })
  };

  try {
    const response = await fetch(url, options);
    const responseData = await response.text();
    
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      parsedData = responseData;
    }

    return {
      status: response.status,
      data: parsedData,
      success: response.ok
    };
  } catch (error) {
    console.error(`Request failed for ${method} ${endpoint}:`, error.message);
    return {
      status: 0,
      data: { error: error.message },
      success: false
    };
  }
}

class SubscriptionSystemTester {
  constructor() {
    this.testResults = [];
    this.createdResources = {
      plans: [],
      subscriptions: [],
      payments: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logEntry);
    
    if (type === 'error' || type === 'success') {
      this.testResults.push({ message, type, timestamp });
    }
  }

  /**
   * Test authentication requirements for protected endpoints
   */
  async testAuthenticationRequired() {
    this.log('Testing authentication requirements...');
    
    const protectedEndpoints = [
      { method: 'GET', path: '/api/subscriptions/current' },
      { method: 'POST', path: '/api/subscriptions' },
      { method: 'PUT', path: '/api/subscriptions/current' },
      { method: 'DELETE', path: '/api/subscriptions/current' },
      { method: 'GET', path: '/api/subscriptions/payments' },
      { method: 'POST', path: '/api/subscriptions/payments' },
      { method: 'GET', path: '/api/subscriptions/usage' },
      { method: 'GET', path: '/api/subscriptions/billing' },
      { method: 'POST', path: '/api/subscriptions/plans' },
      { method: 'PUT', path: '/api/subscriptions/plans/1' }
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await makeRequest(endpoint.method, endpoint.path, null, null);
      
      if (response.status === 401) {
        this.log(`✓ ${endpoint.method} ${endpoint.path} correctly requires authentication`, 'success');
      } else {
        this.log(`✗ ${endpoint.method} ${endpoint.path} should require authentication but got status ${response.status}`, 'error');
      }
    }
  }

  /**
   * Test subscription plan management endpoints
   */
  async testSubscriptionPlanEndpoints() {
    this.log('Testing subscription plan management endpoints...');

    // Test getting all plans (public endpoint)
    const getPlansResponse = await makeRequest('GET', '/api/subscriptions/plans', null, null);
    if (getPlansResponse.success) {
      this.log('✓ Get subscription plans (public) endpoint accessible', 'success');
    } else {
      this.log(`✗ Get subscription plans failed: ${getPlansResponse.status}`, 'error');
    }

    // Test creating a plan (admin endpoint - expected to fail with test token)
    const createPlanData = {
      name: 'Test Plan',
      description: 'A test subscription plan',
      price: 29.99,
      currency: 'USD',
      billingCycle: 'monthly',
      features: ['feature1', 'feature2'],
      limits: { api_calls: 1000, storage: '10GB' },
      isActive: true
    };

    const createPlanResponse = await makeRequest('POST', '/api/subscriptions/plans', createPlanData);
    this.log(`Create plan response: ${createPlanResponse.status} - ${JSON.stringify(createPlanResponse.data)}`);

    // Test getting specific plan
    const getPlanResponse = await makeRequest('GET', '/api/subscriptions/plans/1', null, null);
    this.log(`Get specific plan response: ${getPlanResponse.status}`);

    // Test updating plan (admin endpoint)
    const updatePlanData = { price: 39.99, description: 'Updated test plan' };
    const updatePlanResponse = await makeRequest('PUT', '/api/subscriptions/plans/1', updatePlanData);
    this.log(`Update plan response: ${updatePlanResponse.status}`);
  }

  /**
   * Test subscription lifecycle endpoints
   */
  async testSubscriptionEndpoints() {
    this.log('Testing subscription lifecycle endpoints...');

    // Test getting current subscription (should be 404 if none exists)
    const getCurrentResponse = await makeRequest('GET', '/api/subscriptions/current');
    this.log(`Get current subscription response: ${getCurrentResponse.status}`);

    // Test creating subscription
    const createSubscriptionData = {
      planId: 1,
      billingCycle: 'monthly',
      paymentMethod: 'credit_card',
      metadata: { source: 'test_suite' }
    };

    const createSubResponse = await makeRequest('POST', '/api/subscriptions', createSubscriptionData);
    this.log(`Create subscription response: ${createSubResponse.status} - ${JSON.stringify(createSubResponse.data)}`);

    if (createSubResponse.success && createSubResponse.data.data) {
      this.createdResources.subscriptions.push(createSubResponse.data.data.id);
    }

    // Test updating subscription
    const updateSubData = {
      billingCycle: 'yearly',
      metadata: { updated: 'true' }
    };

    const updateSubResponse = await makeRequest('PUT', '/api/subscriptions/current', updateSubData);
    this.log(`Update subscription response: ${updateSubResponse.status}`);

    // Test cancelling subscription
    const cancelSubResponse = await makeRequest('DELETE', '/api/subscriptions/current?immediate=false');
    this.log(`Cancel subscription response: ${cancelSubResponse.status}`);
  }

  /**
   * Test payment processing endpoints
   */
  async testPaymentEndpoints() {
    this.log('Testing payment processing endpoints...');

    // Test getting subscription payments
    const getPaymentsResponse = await makeRequest('GET', '/api/subscriptions/payments?page=1&limit=10');
    this.log(`Get subscription payments response: ${getPaymentsResponse.status}`);

    // Test processing payment
    const processPaymentData = {
      subscriptionId: 1,
      amount: 29.99,
      currency: 'USD',
      paymentMethod: 'credit_card',
      metadata: { test_payment: true }
    };

    const processPaymentResponse = await makeRequest('POST', '/api/subscriptions/payments', processPaymentData);
    this.log(`Process payment response: ${processPaymentResponse.status} - ${JSON.stringify(processPaymentResponse.data)}`);

    if (processPaymentResponse.success && processPaymentResponse.data.data) {
      this.createdResources.payments.push(processPaymentResponse.data.data.id);
    }
  }

  /**
   * Test usage and billing endpoints
   */
  async testUsageAndBillingEndpoints() {
    this.log('Testing usage and billing endpoints...');

    // Test getting subscription usage
    const usageEndpoints = [
      '/api/subscriptions/usage',
      '/api/subscriptions/usage?period=current_month',
      '/api/subscriptions/usage?period=current_billing_cycle',
      '/api/subscriptions/usage?period=last_30_days'
    ];

    for (const endpoint of usageEndpoints) {
      const response = await makeRequest('GET', endpoint);
      this.log(`Get usage ${endpoint}: ${response.status}`);
    }

    // Test getting billing history
    const billingResponse = await makeRequest('GET', '/api/subscriptions/billing?page=1&limit=20');
    this.log(`Get billing history response: ${billingResponse.status}`);
  }

  /**
   * Test input validation and error handling
   */
  async testInputValidation() {
    this.log('Testing input validation...');

    // Test creating subscription with invalid data
    const invalidSubscriptionData = [
      { planId: 'invalid', billingCycle: 'monthly', paymentMethod: 'card' },
      { planId: 1, billingCycle: 'invalid_cycle', paymentMethod: 'card' },
      { planId: 1, billingCycle: 'monthly' }, // missing paymentMethod
      {} // completely empty
    ];

    for (const [index, invalidData] of invalidSubscriptionData.entries()) {
      const response = await makeRequest('POST', '/api/subscriptions', invalidData);
      if (response.status === 400) {
        this.log(`✓ Invalid subscription data ${index + 1} correctly rejected`, 'success');
      } else {
        this.log(`✗ Invalid subscription data ${index + 1} should be rejected but got status ${response.status}`, 'error');
      }
    }

    // Test creating payment with invalid data
    const invalidPaymentData = [
      { subscriptionId: 'invalid', amount: 10, currency: 'USD', paymentMethod: 'card' },
      { subscriptionId: 1, amount: -10, currency: 'USD', paymentMethod: 'card' },
      { subscriptionId: 1, amount: 10, currency: 'INVALID', paymentMethod: 'card' },
      { subscriptionId: 1, amount: 10, currency: 'USD' } // missing paymentMethod
    ];

    for (const [index, invalidData] of invalidPaymentData.entries()) {
      const response = await makeRequest('POST', '/api/subscriptions/payments', invalidData);
      if (response.status === 400) {
        this.log(`✓ Invalid payment data ${index + 1} correctly rejected`, 'success');
      } else {
        this.log(`✗ Invalid payment data ${index + 1} should be rejected but got status ${response.status}`, 'error');
      }
    }

    // Test creating plan with invalid data
    const invalidPlanData = [
      { name: '', price: 10, currency: 'USD', billingCycle: 'monthly' }, // empty name
      { name: 'Test', price: -10, currency: 'USD', billingCycle: 'monthly' }, // negative price
      { name: 'Test', price: 10, currency: 'TOOLONG', billingCycle: 'monthly' }, // invalid currency
      { name: 'Test', price: 10, currency: 'USD', billingCycle: 'invalid' } // invalid billing cycle
    ];

    for (const [index, invalidData] of invalidPlanData.entries()) {
      const response = await makeRequest('POST', '/api/subscriptions/plans', invalidData);
      if (response.status === 400) {
        this.log(`✓ Invalid plan data ${index + 1} correctly rejected`, 'success');
      } else {
        this.log(`✗ Invalid plan data ${index + 1} should be rejected but got status ${response.status}`, 'error');
      }
    }
  }

  /**
   * Test error handling scenarios
   */
  async testErrorHandling() {
    this.log('Testing error handling scenarios...');

    // Test getting non-existent plan
    const nonExistentPlanResponse = await makeRequest('GET', '/api/subscriptions/plans/99999', null, null);
    if (nonExistentPlanResponse.status === 404) {
      this.log('✓ Non-existent plan correctly returns 404', 'success');
    } else {
      this.log(`✗ Non-existent plan should return 404 but got ${nonExistentPlanResponse.status}`, 'error');
    }

    // Test updating non-existent plan
    const updateNonExistentResponse = await makeRequest('PUT', '/api/subscriptions/plans/99999', { price: 100 });
    if (updateNonExistentResponse.status === 404) {
      this.log('✓ Updating non-existent plan correctly returns 404', 'success');
    } else {
      this.log(`✗ Updating non-existent plan should return 404 but got ${updateNonExistentResponse.status}`, 'error');
    }

    // Test processing payment for non-existent subscription
    const invalidPayment = {
      subscriptionId: 99999,
      amount: 10,
      currency: 'USD',
      paymentMethod: 'card'
    };

    const invalidPaymentResponse = await makeRequest('POST', '/api/subscriptions/payments', invalidPayment);
    if (invalidPaymentResponse.status === 404) {
      this.log('✓ Payment for non-existent subscription correctly returns 404', 'success');
    } else {
      this.log(`✗ Payment for non-existent subscription should return 404 but got ${invalidPaymentResponse.status}`, 'error');
    }

    // Test invalid plan ID format
    const invalidPlanIdResponse = await makeRequest('GET', '/api/subscriptions/plans/invalid-id', null, null);
    if (invalidPlanIdResponse.status === 400) {
      this.log('✓ Invalid plan ID format correctly returns 400', 'success');
    } else {
      this.log(`✗ Invalid plan ID format should return 400 but got ${invalidPlanIdResponse.status}`, 'error');
    }
  }

  /**
   * Run all subscription system tests
   */
  async runAllTests() {
    this.log('Starting comprehensive subscription system test suite...');
    this.log('='.repeat(60));

    try {
      await this.testAuthenticationRequired();
      this.log('-'.repeat(40));
      
      await this.testSubscriptionPlanEndpoints();
      this.log('-'.repeat(40));
      
      await this.testSubscriptionEndpoints();
      this.log('-'.repeat(40));
      
      await this.testPaymentEndpoints();
      this.log('-'.repeat(40));
      
      await this.testUsageAndBillingEndpoints();
      this.log('-'.repeat(40));
      
      await this.testInputValidation();
      this.log('-'.repeat(40));
      
      await this.testErrorHandling();
      this.log('-'.repeat(40));

    } catch (error) {
      this.log(`Test suite encountered an error: ${error.message}`, 'error');
    }

    // Summary
    this.log('='.repeat(60));
    this.log('SUBSCRIPTION SYSTEM TEST SUMMARY');
    this.log('='.repeat(60));
    
    const successCount = this.testResults.filter(r => r.type === 'success').length;
    const errorCount = this.testResults.filter(r => r.type === 'error').length;
    
    this.log(`Total successful tests: ${successCount}`, 'success');
    this.log(`Total failed tests: ${errorCount}`, errorCount > 0 ? 'error' : 'info');
    
    if (errorCount > 0) {
      this.log('\nFailed tests:');
      this.testResults
        .filter(r => r.type === 'error')
        .forEach(r => this.log(`  - ${r.message}`, 'error'));
    }
    
    this.log('\nCreated test resources:');
    this.log(`  Plans: ${this.createdResources.plans.length}`);
    this.log(`  Subscriptions: ${this.createdResources.subscriptions.length}`);
    this.log(`  Payments: ${this.createdResources.payments.length}`);
    
    this.log('\nSubscription system migration validation complete!');
    
    return {
      success: errorCount === 0,
      successCount,
      errorCount,
      createdResources: this.createdResources
    };
  }
}

// Run the tests
async function runAllTests() {
  const tester = new SubscriptionSystemTester();
  return await tester.runAllTests();
}

// Main execution
console.log('🔧 Starting Subscription Management System Tests...\n');

runAllTests()
  .then(results => {
    console.log('\n📊 Test Results:', results);
    process.exit(results.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });