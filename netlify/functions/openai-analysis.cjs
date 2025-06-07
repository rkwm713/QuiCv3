const { OpenAI } = require('openai');

// Helper to decrypt stored keys (same approach as api-key-manager)
const decrypt = (encryptedText) => {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured');
  return Buffer.from(encryptedText, 'base64').toString();
};

// Retrieve OpenAI API key from Supabase (fallback to env var)
const getApiKey = async () => {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.log('Supabase credentials not configured, using environment variable fallback');
      return process.env.OPENAI_API_KEY;
    }

    // Query the Supabase REST endpoint
    const url = `${SUPABASE_URL}/rest/v1/api_keys?select=encrypted_value&key_name=eq.openai-api-key&limit=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Supabase REST error: ${response.status}`);
      return process.env.OPENAI_API_KEY;
    }

    const json = await response.json();

    if (!Array.isArray(json) || json.length === 0) {
      console.log('No API key found in Supabase, falling back to environment variable');
      return process.env.OPENAI_API_KEY;
    }

    return decrypt(json[0].encrypted_value);
  } catch (error) {
    console.error('Error retrieving API key from Supabase:', error);
    return process.env.OPENAI_API_KEY;
  }
};

exports.handler = async (event, context) => {
  // CORS preflight
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

  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    let requestData;
    try {
      requestData = JSON.parse(event.body || '{}');
    } catch (err) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { prompt, analysisType = 'general', stream = false } = requestData;
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

    const openai = new OpenAI({ apiKey });

    // Check if streaming is requested
    if (stream) {
      // Return streaming response
      const stream = await Promise.race([
        openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
          stream: true
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout after 22 seconds')), 22000))
      ]);

      // For streaming, we need to collect chunks and return complete response
      // Since Netlify Functions don't support true streaming to browser
      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ 
          result: fullResponse, 
          analysisType, 
          timestamp: new Date().toISOString(),
          streamed: true 
        })
      };
    } else {
      // Standard non-streaming response with Pro timeout (22 seconds, leaving 4 second buffer)
      const response = await Promise.race([
        openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000  // Increased from 500 back to reasonable level
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout after 22 seconds')), 22000))
      ]);

      const text = response.choices[0].message.content;

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({ result: text, analysisType, timestamp: new Date().toISOString() })
      };
    }
  } catch (error) {
    console.error('OpenAI API Error:', error);

    let statusCode = 500;
    let errorMessage = 'Failed to generate analysis';
    if (error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'Request timeout – analysis took too long';
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      statusCode = 429;
      errorMessage = 'API quota exceeded';
    } else if (error.message.includes('authentication')) {
      statusCode = 401;
      errorMessage = 'Invalid API key configuration';
    }

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: errorMessage, details: error.message })
    };
  }
}; 