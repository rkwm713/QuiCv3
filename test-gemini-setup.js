// Test script to diagnose Gemini API setup
// Run with: node test-gemini-setup.js

console.log('🔍 Diagnosing QuiC AI Setup...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('NETLIFY_DATABASE_URL:', process.env.NETLIFY_DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('ADMIN_TOKEN:', process.env.ADMIN_TOKEN ? '✅ Set' : '❌ Not set');
console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? '✅ Set' : '❌ Not set');

// Test Gemini API if key is available
if (process.env.GEMINI_API_KEY) {
  console.log('\n🤖 Testing Gemini API...');
  testGeminiAPI();
} else {
  console.log('\n⚠️  Cannot test Gemini API - no API key found');
  console.log('Set GEMINI_API_KEY environment variable or store it via the API key manager');
}

// Test database connection if URL is available
if (process.env.NETLIFY_DATABASE_URL) {
  console.log('\n💾 Testing database connection...');
  testDatabaseConnection();
} else {
  console.log('\n⚠️  Cannot test database - no database URL found');
  console.log('This is normal if you haven\'t set up Neon database yet');
}

async function testGeminiAPI() {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent('Hello, please respond with "AI is working!"');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini API working! Response:', text.trim());
  } catch (error) {
    console.log('❌ Gemini API error:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('   → Check your GEMINI_API_KEY is valid');
      console.log('   → Get a new key at: https://makersuite.google.com/app/apikey');
    } else if (error.message.includes('quota')) {
      console.log('   → API quota exceeded, try again later');
    }
  }
}

async function testDatabaseConnection() {
  try {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connection working! Current time:', result[0].current_time);
    
    // Test API keys table
    try {
      const keyResult = await sql`SELECT COUNT(*) as count FROM api_keys`;
      console.log('✅ API keys table accessible, stored keys:', keyResult[0].count);
    } catch (tableError) {
      console.log('⚠️  API keys table not found - this is normal for first setup');
    }
    
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
    console.log('   → Check your NETLIFY_DATABASE_URL is correct');
    console.log('   → Ensure your Neon database is active');
  }
}

console.log('\n🔧 Troubleshooting Tips:');
console.log('1. If GEMINI_API_KEY is not set, add it to your .env file or Netlify environment variables');
console.log('2. If using Neon database, ensure NETLIFY_DATABASE_URL is set correctly');
console.log('3. Check Netlify function logs for more detailed error messages');
console.log('4. Try accessing: https://your-site.netlify.app/.netlify/functions/gemini-analysis'); 