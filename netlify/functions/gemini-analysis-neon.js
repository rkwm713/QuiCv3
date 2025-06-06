const { GoogleGenerativeAI } = require('@google/generative-ai');
const { neon } = require('@neondatabase/serverless');

// Helper function to decrypt API key (matches api-key-manager-neon.js)
const decrypt = (encryptedText) => {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured');
  return Buffer.from(encryptedText, 'base64').toString();
};

// Helper function to get API key from Neon database
const getApiKey = async () => {
  try {
    // Use NETLIFY_DATABASE_URL instead of NEON_DATABASE_URL
    const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.NEON_DATABASE_URL;
    
    if (!databaseUrl) {
      console.log('No database URL configured, falling back to environment variable');
      return process.env.GEMINI_API_KEY;
    }
    
    // Initialize Neon connection
    const sql = neon(databaseUrl);
    
    // Query for the API key
    const [keyRecord] = await sql`
      SELECT encrypted_value 
      FROM api_keys 
      WHERE key_name = 'gemini-api-key'
    `;
    
    if (!keyRecord) {
      // Fallback to environment variable for backward compatibility
      console.log('No API key found in database, falling back to environment variable');
      return process.env.GEMINI_API_KEY;
    }
    
    return decrypt(keyRecord.encrypted_value);
  } catch (error) {
    console.error('Error retrieving API key from Neon database:', error);
    // Fallback to environment variable
    return process.env.GEMINI_API_KEY;
  }
};

exports.handler = async (event, context) => {
  // Set function timeout context
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  try {
    console.log('Gemini analysis function started');
    
    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }
    
    const { prompt, analysisType } = requestBody;
    
    if (!prompt) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    // Get API key from Neon database (with fallback to env vars)
    console.log('Retrieving API key...');
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      console.error('No API key available');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'API key not configured',
          details: 'Please set up your Gemini API key in the database or environment variables'
        })
      };
    }

    console.log('Initializing Gemini AI...');
    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    console.log('Generating content...');
    // Generate response with timeout protection
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 25000)
      )
    ]);
    
    const response = await result.response;
    const text = response.text();

    console.log('Analysis completed successfully');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        result: text,
        analysisType: analysisType || 'general',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Gemini API Error:', error);
    console.error('Error stack:', error.stack);
    
    // Determine appropriate error message
    let errorMessage = 'Failed to generate analysis';
    let statusCode = 500;
    
    if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout - analysis took too long';
      statusCode = 504;
    } else if (error.message.includes('API key')) {
      errorMessage = 'Invalid API key configuration';
      statusCode = 401;
    } else if (error.message.includes('quota')) {
      errorMessage = 'API quota exceeded';
      statusCode = 429;
    }
    
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : 'AI service error',
        timestamp: new Date().toISOString()
      })
    };
  }
}; 