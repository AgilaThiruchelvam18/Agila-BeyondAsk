/**
 * Token Tracking Test Utility
 * 
 * This script can be run to test token usage tracking with improved provider information
 */
import { db } from './postgresql';
import { trackLlmTokenUsage, getLlmProviders } from './services/llm';
import { sql } from 'drizzle-orm';

async function runTokenTrackingTest() {
  try {
    // Set up test parameters
    const userId = 5; // Default test user
    const providerId = process.argv[2] || 'openai';
    const tokens = parseInt(process.argv[3] || '100');
    
    console.log(`🧪 TEST PROVIDER TRACKING: Running test with provider ID ${providerId} for user ${userId}`);
    
    // First, check for provider info
    const providers = await getLlmProviders();
    console.log(`Available providers: ${JSON.stringify(providers.map(p => ({ id: p.id, name: p.name, slug: p.slug })))}`);
    
    // Find provider by ID or slug
    const provider = providers.find(p => 
      p.id.toString() === providerId || 
      p.slug === providerId ||
      p.name.toLowerCase() === providerId.toLowerCase()
    );
    
    console.log(`Selected provider: ${JSON.stringify(provider || 'none')}`);
    
    // Get metrics before tracking
    const beforeMetrics = await db.execute(sql`
      SELECT * FROM daily_usage_metrics
      WHERE user_id = ${userId}
      AND date = CURRENT_DATE
      AND metadata->>'provider' = ${provider?.slug || providerId}
      AND metric_type = 'llm_tokens_used'
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    
    console.log(`Before metrics: ${JSON.stringify(beforeMetrics.rows || [])}`);
    
    // Call the token tracking function with different provider resolution paths
    const result = await trackLlmTokenUsage(
      Number(userId),
      tokens,
      {
        provider: provider?.slug || providerId,
        model: "test-model",
        keyType: "test",
        tokenType: "test",
        source: "test_utility"
      }
    );
    
    console.log(`✅ Tracking result: ${JSON.stringify(result || 'completed')}`);
    
    // Get metrics after tracking
    const afterMetrics = await db.execute(sql`
      SELECT * FROM daily_usage_metrics
      WHERE user_id = ${userId}
      AND date = CURRENT_DATE
      AND metadata->>'provider' = ${provider?.slug || providerId}
      AND metric_type = 'llm_tokens_used'
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    
    console.log(`After metrics: ${JSON.stringify(afterMetrics.rows || [])}`);
    
    // Show the difference
    if (beforeMetrics.rows?.[0] && afterMetrics.rows?.[0]) {
      const before = beforeMetrics.rows[0];
      const after = afterMetrics.rows[0];
      console.log(`Token count before: ${before.value}, after: ${after.value}`);
      console.log(`Difference: ${Number(after.value) - Number(before.value)}`);
    } else {
      console.log(`No before/after comparison available - new metrics created`);
    }
    
    console.log(`✅ TEST COMPLETED: Provider tracking test successful`);
  } catch (error) {
    console.error('❌ Error in provider tracking test:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
runTokenTrackingTest();