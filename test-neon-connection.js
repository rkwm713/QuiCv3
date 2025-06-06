// Test script to verify Neon connection
// Run this locally with: node test-neon-connection.js

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function testNeonConnection() {
  console.log('🔍 Testing Neon database connection...\n');

  try {
    // Check if NETLIFY_DATABASE_URL is available
    const neonUrl = process.env.NETLIFY_DATABASE_URL;
    
    if (!neonUrl) {
      console.log('❌ NETLIFY_DATABASE_URL not found in environment variables');
      console.log('💡 You need to:');
      console.log('   1. Install Neon extension in Netlify');
      console.log('   2. Or add NETLIFY_DATABASE_URL to your .env.local file');
      return false;
    }

    console.log('✅ NETLIFY_DATABASE_URL found');
    
    // Test connection
    const sql = neon(neonUrl);
    
    console.log('🔌 Attempting database connection...');
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    
    console.log('✅ Connection successful!');
    console.log('📅 Database time:', result[0].current_time);
    console.log('📊 Database version:', result[0].db_version.split(' ')[0]);
    
    // Test table creation (what the function will do)
    console.log('\n🛠️  Testing table creation...');
    await sql`
      CREATE TABLE IF NOT EXISTS api_keys_test (
        id SERIAL PRIMARY KEY,
        key_name VARCHAR(255) UNIQUE NOT NULL,
        encrypted_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Table creation successful');

    // Test insert
    console.log('📝 Testing insert operation...');
    await sql`
      INSERT INTO api_keys_test (key_name, encrypted_value)
      VALUES ('test-key', 'encrypted-test-value')
      ON CONFLICT (key_name) DO UPDATE SET 
        encrypted_value = EXCLUDED.encrypted_value
    `;
    console.log('✅ Insert operation successful');

    // Test select
    console.log('🔍 Testing select operation...');
    const testResult = await sql`
      SELECT * FROM api_keys_test WHERE key_name = 'test-key'
    `;
    console.log('✅ Select operation successful');
    console.log('📄 Test record:', testResult[0]);

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await sql`DROP TABLE IF EXISTS api_keys_test`;
    console.log('✅ Cleanup successful');

    console.log('\n🎉 All tests passed! Your Neon connection is ready.');
    return true;

  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.log('💡 This might be a credentials issue. Check your Neon dashboard.');
    } else if (error.message.includes('connection')) {
      console.log('💡 This might be a network issue. Check your internet connection.');
    } else if (error.message.includes('database')) {
      console.log('💡 This might be a database configuration issue.');
    }
    
    return false;
  }
}

// Check other required environment variables
function checkEnvironmentVariables() {
  console.log('\n🔧 Checking environment variables...');
  
  const required = [
    'ADMIN_TOKEN',
    'ENCRYPTION_KEY'
  ];
  
  const optional = [
    'GEMINI_API_KEY'
  ];
  
  let allGood = true;
  
  for (const envVar of required) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Configured`);
    } else {
      console.log(`❌ ${envVar}: Missing (required)`);
      allGood = false;
    }
  }
  
  for (const envVar of optional) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Configured (optional)`);
    } else {
      console.log(`⚠️  ${envVar}: Missing (optional fallback)`);
    }
  }
  
  return allGood;
}

// Main execution
async function main() {
  console.log('🚀 QuiC Neon Connection Test\n');
  
  const envOK = checkEnvironmentVariables();
  const dbOK = await testNeonConnection();
  
  console.log('\n📋 Summary:');
  console.log(`Environment Variables: ${envOK ? '✅ OK' : '❌ Issues'}`);
  console.log(`Database Connection: ${dbOK ? '✅ OK' : '❌ Issues'}`);
  
  if (envOK && dbOK) {
    console.log('\n🎉 Everything looks good! Ready to deploy.');
  } else {
    console.log('\n⚠️  Please fix the issues above before deploying.');
  }
}

// Run the test
main().catch(console.error); 