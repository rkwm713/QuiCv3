// Direct test of the Neon database connection (CommonJS version)
// This bypasses environment variables and tests the connection directly

const { neon } = require('@neondatabase/serverless');

const connectionString = 'postgresql://neondb_owner:npg_5XVhiqSzmT1R@ep-raspy-block-a581pmgp-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function testNeonConnection() {
  console.log('🔍 Testing Your Neon Database Connection...\n');
  
  try {
    console.log('📡 Connecting to database...');
    const sql = neon(connectionString);
    
    // Test basic connection
    console.log('⏱️  Running test query...');
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    
    console.log('✅ Database connection successful!');
    console.log('📅 Current time:', result[0].current_time);
    console.log('🗄️  Database version:', result[0].db_version.substring(0, 50) + '...');
    
    // Test if API keys table exists
    console.log('\n🔑 Checking for API keys table...');
    try {
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'api_keys'
        )
      `;
      
      if (tableCheck[0].exists) {
        console.log('✅ API keys table exists');
        
        // Count existing keys
        const keyCount = await sql`SELECT COUNT(*) as count FROM api_keys`;
        console.log('📊 Stored API keys:', keyCount[0].count);
      } else {
        console.log('⚠️  API keys table does not exist yet');
        console.log('   This is normal - it will be created automatically when you first use the API key manager');
      }
    } catch (tableError) {
      console.log('⚠️  Could not check API keys table:', tableError.message);
    }
    
    console.log('\n✅ Your Neon database is ready to use!');
    console.log('\n🚀 Next steps:');
    console.log('1. Add this connection string to Netlify environment variables');
    console.log('2. Add the ADMIN_TOKEN and ENCRYPTION_KEY');
    console.log('3. Deploy your site');
    console.log('4. Store your Gemini API key using the API key manager');
    
  } catch (error) {
    console.log('❌ Database connection failed!');
    console.log('Error:', error.message);
    
    if (error.message.includes('timeout')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('• Your Neon database might be sleeping - try again in a few seconds');
      console.log('• Check if your Neon compute is active in the Neon dashboard');
    } else if (error.message.includes('password') || error.message.includes('authentication')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('• Check your database password is correct');
      console.log('• Ensure your Neon database user has the right permissions');
    } else if (error.message.includes('does not exist')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('• Check your database name is correct');
      console.log('• Ensure your Neon project is active');
    } else {
      console.log('\n💡 General troubleshooting:');
      console.log('• Check your internet connection');
      console.log('• Verify the connection string is complete and correct');
      console.log('• Check Neon status: https://status.neon.tech');
    }
  }
}

// Run the test
testNeonConnection().catch(console.error); 