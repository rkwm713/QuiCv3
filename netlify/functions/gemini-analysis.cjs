const { GoogleGenerativeAI } = require('@google/generative-ai');
// Removed Neon – now using Supabase REST API

// Helper function to decrypt API key (matches api-key-manager-neon.js)
const decrypt = (encryptedText) => {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured');
  return Buffer.from(encryptedText, 'base64').toString();
};

// Helper to get API key from Supabase (fallback to env var)
const getApiKey = async () => {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.log('Supabase credentials not configured, using environment variable fallback');
      return process.env.GEMINI_API_KEY;
    }

    const url = `${SUPABASE_URL}/rest/v1/api_keys?select=encrypted_value&key_name=eq.gemini-api-key&limit=1`;

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Supabase REST error: ${response.status}`);
      return process.env.GEMINI_API_KEY;
    }

    const json = await response.json();

    if (!Array.isArray(json) || json.length === 0) {
      console.log('No API key found in Supabase, falling back to environment variable');
      return process.env.GEMINI_API_KEY;
    }

    return decrypt(json[0].encrypted_value);
  } catch (error) {
    console.error('Error retrieving API key from Supabase:', error);
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
    console.log('Attempting to retrieve API key...');
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      console.error('No API key available from database or environment variables');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'API key not configured',
          details: 'Please set up your Gemini API key in the database or environment variables. Check your GEMINI_API_KEY environment variable or use the API key manager.'
        })
      };
    }
    
    console.log('API key retrieved successfully');

    // Parse request body
    let requestData;
    try {
      requestData = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError.message 
        })
      };
    }

    const { prompt, analysisType } = requestData;
    
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
    console.log('Initializing Gemini AI...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Generate response with timeout
    console.log('Generating content with Gemini...');
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 25 seconds')), 25000)
      )
    ]);
    
    const response = await result.response;
    const text = response.text();
    console.log('Content generated successfully');

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
    
    // Determine appropriate error message and status code
    let errorMessage = 'Failed to generate analysis';
    let statusCode = 500;
    let details = 'AI service error';
    
    if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout - analysis took too long';
      statusCode = 504;
      details = 'The AI analysis request timed out. Please try again with a shorter prompt.';
    } else if (error.message.includes('API key') || error.message.includes('authentication')) {
      errorMessage = 'Invalid API key configuration';
      statusCode = 401;
      details = 'The Google Gemini API key is invalid or expired. Please check your configuration.';
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      errorMessage = 'API quota exceeded';
      statusCode = 429;
      details = 'Google Gemini API quota has been exceeded. Please try again later.';
    } else if (process.env.NODE_ENV === 'development') {
      details = error.message;
    }
    
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: errorMessage,
        details: details,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 