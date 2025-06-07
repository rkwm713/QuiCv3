// Removed Neon – interacting with Supabase REST API instead

// Simple encryption/decryption utilities (same as before)
const encrypt = (text) => {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured');
  return Buffer.from(text).toString('base64');
};

const decrypt = (encryptedText) => {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured');
  return Buffer.from(encryptedText, 'base64').toString();
};

// Helper: build Supabase headers
const supabaseHeaders = () => {
  const { SUPABASE_SERVICE_ROLE_KEY } = process.env;
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
};

// Utility to upsert/delete/fetch via Supabase REST
const supabaseRequest = async (method, path, body) => {
  const { SUPABASE_URL } = process.env;
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not configured');
  const url = `${SUPABASE_URL}${path}`;
  const options = {
    method,
    headers: supabaseHeaders()
  };
  if (body) options.body = JSON.stringify(body);
  return fetch(url, options);
};

exports.handler = async (event, context) => {
  // Only allow admin access
  const adminToken = event.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Validate required environment variables for Supabase
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Supabase configuration missing' })
    };
  }

  try {
    const keyName = 'openai-api-key'; // Changed from 'gemini-api-key' to 'openai-api-key'

    switch (event.httpMethod) {
      case 'GET':
        // Retrieve API key via Supabase
        {
          const res = await supabaseRequest('GET', `/rest/v1/api_keys?select=encrypted_value,updated_at&key_name=eq.${keyName}&limit=1`);
          if (!res.ok) {
            console.error('Supabase fetch error', res.status);
            return { 
              statusCode: 500, 
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: 'Database error' }) 
            };
          }
          const json = await res.json();
          if (!Array.isArray(json) || json.length === 0) {
            return { 
              statusCode: 404, 
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: 'API key not found' }) 
            };
          }
          const decryptedKey = decrypt(json[0].encrypted_value);
          return {
            statusCode: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ key: decryptedKey, lastUpdated: json[0].updated_at })
          };
        }

      case 'POST':
        // Store/update API key
        const { apiKey } = JSON.parse(event.body);
        if (!apiKey || typeof apiKey !== 'string') {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Valid API key required' })
          };
        }

        const encryptedKey = encrypt(apiKey);
        
        try {
          // First try to update existing record
          const updateRes = await supabaseRequest('PATCH', `/rest/v1/api_keys?key_name=eq.${keyName}`, {
            encrypted_value: encryptedKey,
            updated_at: new Date().toISOString()
          });

          if (updateRes.ok) {
            // Check if any rows were affected
            const updateResult = await updateRes.text();
            console.log('Update result:', updateResult);
            
            // If no rows were updated, insert new record
            if (!updateResult || updateResult === '[]') {
              console.log('No existing record found, inserting new one');
              const insertRes = await supabaseRequest('POST', '/rest/v1/api_keys', {
                key_name: keyName,
                encrypted_value: encryptedKey
              });

              if (!insertRes.ok) {
                const errorText = await insertRes.text();
                console.error('Supabase insert error:', insertRes.status, errorText);
                return { 
                  statusCode: 500, 
                  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                  body: JSON.stringify({ error: 'Failed to store key', details: errorText }) 
                };
              }
            }
          } else {
            const errorText = await updateRes.text();
            console.error('Supabase update error:', updateRes.status, errorText);
            return { 
              statusCode: 500, 
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: 'Failed to store key', details: errorText }) 
            };
          }

          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ message: 'API key stored successfully' })
          };
        } catch (dbError) {
          console.error('Database operation error:', dbError);
          return { 
            statusCode: 500, 
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Failed to store key', details: dbError.message }) 
          };
        }

      case 'DELETE':
        // Delete API key
        {
          const res = await supabaseRequest('DELETE', `/rest/v1/api_keys?key_name=eq.${keyName}`);
          if (!res.ok) {
            return { 
              statusCode: 500, 
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: 'Failed to delete key' }) 
            };
          }
          return { 
            statusCode: 200, 
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'API key deleted' }) 
          };
        }

      case 'OPTIONS':
        // Handle CORS preflight
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-admin-token'
          },
          body: ''
        };

      default:
        return {
          statusCode: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('API Key Manager Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Database error'
      })
    };
  }
}; 