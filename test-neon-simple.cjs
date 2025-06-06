// Simple Neon connection test using CommonJS
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

console.log('🚀 QuiC Neon Connection Test (Simple Version)\n');

async function testConnection() {
  try {
    console.log('🔧 Checking environment variables...');
    
    // Check required variables
    const netlifyDbUrl = process.env.NETLIFY_DATABASE_URL;
    const adminToken = process.env.ADMIN_TOKEN;
    const encryptionKey = process.env.ENCRYPTION_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    
    console.log(`✅ NETLIFY_DATABASE_URL: ${netlifyDbUrl ? 'Found' : '❌ Missing'}`);
    console.log(`✅ ADMIN_TOKEN: ${adminToken ? 'Found' : '❌ Missing'}`);
    console.log(`✅ ENCRYPTION_KEY: ${encryptionKey ? 'Found' : '❌ Missing'}`);
    console.log(`✅ GEMINI_API_KEY: ${geminiKey ? 'Found' : '⚠️ Missing'}`);
    
    if (!netlifyDbUrl) {
      console.log('\n❌ Cannot test database connection without NETLIFY_DATABASE_URL');
      return false;
    }
    
    console.log('\n🔌 Testing database connection...');
    const sql = neon(netlifyDbUrl);
    
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    
    console.log('✅ Connection successful!');
    console.log('📅 Database time:', result[0].current_time);
    console.log('📊 Database version:', result[0].db_version.split(' ')[0]);
    
    console.log('\n🛠️ Testing table operations...');
    
    // Test table creation
    await sql`
      CREATE TABLE IF NOT EXISTS test_connection (
        id SERIAL PRIMARY KEY,
        test_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Table creation: OK');
    
    // Test insert
    await sql`
      INSERT INTO test_connection (test_value) 
      VALUES ('test-from-local') 
    `;
    console.log('✅ Insert operation: OK');
    
    // Test select
    const testData = await sql`
      SELECT * FROM test_connection 
      WHERE test_value = 'test-from-local'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    console.log('✅ Select operation: OK');
    console.log('📄 Test record:', testData[0]);
    
    // Cleanup
    await sql`DROP TABLE test_connection`;
    console.log('✅ Cleanup: OK');
    
    console.log('\n🎉 All tests passed! Your Neon setup is working perfectly.');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.log('💡 Check your database credentials in Neon dashboard');
    } else if (error.message.includes('connection')) {
      console.log('💡 Check your internet connection and database URL');
    }
    
    return false;
  }
}

// Run the test
testConnection()
  .then(success => {
    console.log(`\n📋 Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  }); 