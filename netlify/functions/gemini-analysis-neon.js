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
    // Initialize Neon connection
    const sql = neon(process.env.NEON_DATABASE_URL);
    
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
    // Get API key from Neon database (with fallback to env vars)
    const apiKey = await getApiKey();
    
    if (!apiKey) {
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

    // Parse request body
    const { prompt, analysisType } = JSON.parse(event.body);
    
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

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

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
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to generate analysis',
        details: process.env.NODE_ENV === 'development' ? error.message : 'AI service error'
      })
    };
  }
}; 