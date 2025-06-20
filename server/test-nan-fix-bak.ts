import { getDefaultUserApiKey, generateEmbeddings } from './services/llm';
import { connectToDB } from './postgresql';

async function testNaNHandling() {
  console.log('Connecting to database...');
  const connected = await connectToDB();
  
  if (connected) {
    console.log('===== TESTING ENHANCED NAN HANDLING =====');
    
    // Test getDefaultUserApiKey with various values
    console.log('\n----- Testing getDefaultUserApiKey -----');
    try {
      console.log('\nTest with normal values:');
      const result1 = await getDefaultUserApiKey(1, 1);
      console.log('Result:', result1 ? 'Key found' : 'No key found');
    } catch (error) {
      console.error('Error with normal values:', error);
    }
    
    try {
      console.log('\nTest with string values:');
      const result2 = await getDefaultUserApiKey('1', '1');
      console.log('Result:', result2 ? 'Key found' : 'No key found');
    } catch (error) {
      console.error('Error with string values:', error);
    }
    
    try {
      console.log('\nTest with NaN values:');
      const result3 = await getDefaultUserApiKey(1, NaN);
      console.log('Result:', result3 ? 'Key found' : 'No key found');
    } catch (error) {
      console.error('Error with NaN values:', error);
    }
    
    try {
      console.log('\nTest with invalid string values:');
      const result4 = await getDefaultUserApiKey('invalid', 'also-invalid');
      console.log('Result:', result4 ? 'Key found' : 'No key found');
    } catch (error) {
      console.error('Error with invalid string values:', error);
    }
    
    try {
      console.log('\nTest with mixed problematic values:');
      const result5 = await getDefaultUserApiKey(undefined, null);
      console.log('Result:', result5 ? 'Key found' : 'No key found');
    } catch (error) {
      console.error('Error with mixed problematic values:', error);
    }
    
    try {
      console.log('\nTest with Object values (extreme case):');
      const result6 = await getDefaultUserApiKey({} as any, [] as any);
      console.log('Result:', result6 ? 'Key found' : 'No key found');
    } catch (error) {
      console.error('Error with Object values:', error);
    }
    
    // Test generateEmbeddings with various values
    console.log('\n----- Testing generateEmbeddings -----');
    
    // We'll only test with problematic values since we don't want to make actual API calls
    try {
      console.log('\nTest with NaN values:');
      // This will fail in the API call but the NaN handling should work
      await generateEmbeddings(1, NaN, 'Test text');
      console.log('Made it past the NaN handling in generateEmbeddings');
    } catch (error) {
      if (error.message === 'No API key found for this provider') {
        console.log('Successfully handled NaN - failed with expected error: No API key found for this provider');
      } else {
        console.error('Error with NaN values in generateEmbeddings:', error);
      }
    }
    
    try {
      console.log('\nTest with invalid string values:');
      await generateEmbeddings('invalid', 'also-invalid', 'Test text');
      console.log('Made it past the invalid string handling in generateEmbeddings');
    } catch (error) {
      if (error.message === 'No API key found for this provider') {
        console.log('Successfully handled invalid strings - failed with expected error: No API key found for this provider');
      } else {
        console.error('Error with invalid string values in generateEmbeddings:', error);
      }
    }
    
    try {
      console.log('\nTest with mixed problematic values:');
      await generateEmbeddings(undefined, null, 'Test text');
      console.log('Made it past the mixed problems handling in generateEmbeddings');
    } catch (error) {
      if (error.message === 'No API key found for this provider') {
        console.log('Successfully handled mixed problems - failed with expected error: No API key found for this provider');
      } else {
        console.error('Error with mixed problematic values in generateEmbeddings:', error);
      }
    }
    
    console.log('\nAll tests completed.');
  } else {
    console.error('Failed to connect to database');
  }
}

// Run the test
testNaNHandling().catch(console.error);