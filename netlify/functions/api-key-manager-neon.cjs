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

// Helper headers & utility for Supabase
const supabaseHeaders = () => {
  const { SUPABASE_SERVICE_ROLE_KEY } = process.env;
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
};

const supabaseRequest = async (method, path, body) => {
  const { SUPABASE_URL } = process.env;
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not set');
  const options = { method, headers: supabaseHeaders() };
  if (body) options.body = JSON.stringify(body);
  return fetch(`${SUPABASE_URL}${path}`, options);
};

export const handler = async (event, context) => {
  // Only allow admin access
  const adminToken = event.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Validate Supabase vars
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Supabase not configured' })
    };
  }

  try {
    const keyName = 'gemini-api-key'; // Fixed key name for this implementation

    switch (event.httpMethod) {
      case 'GET':
        // Retrieve API key
        {
          const res = await supabaseRequest('GET', `/rest/v1/api_keys?select=encrypted_value,updated_at&key_name=eq.${keyName}&limit=1`);
          if (!res.ok) {
            return {statusCode:500, body:JSON.stringify({error:'Database error'})};
          }
          const json = await res.json();
          if (!Array.isArray(json) || json.length===0){
            return {statusCode:404, body:JSON.stringify({error:'API key not found'})};
          }
          const decryptedKey = decrypt(json[0].encrypted_value);
          return {statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({key: decryptedKey, lastUpdated: json[0].updated_at})};
        }

      case 'POST':
        // Store/update API key
        const { apiKey } = JSON.parse(event.body);
        if (!apiKey || typeof apiKey !== 'string') {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Valid API key required' })
          };
        }

        const encryptedKey = encrypt(apiKey);
        
        // Use UPSERT
        {
          const res = await supabaseRequest('POST', '/rest/v1/api_keys?on_conflict=key_name&return=representation', [{key_name:keyName, encrypted_value: encryptedKey}]);
          if(!res.ok){ return {statusCode:500, body:JSON.stringify({error:'Failed to store key'})};}
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'API key stored successfully' })
        };

      case 'DELETE':
        // Delete API key
        {
          const res = await supabaseRequest('DELETE', `/rest/v1/api_keys?key_name=eq.${keyName}`);
          if(!res.ok){return {statusCode:500, body:JSON.stringify({error:'Failed to delete key'})};}
          return {statusCode:200, body:JSON.stringify({message:'API key deleted'})};
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
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('API Key Manager Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Database error'
      })
    };
  }
}; 