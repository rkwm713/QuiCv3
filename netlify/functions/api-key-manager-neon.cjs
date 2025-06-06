import { neon } from '@neondatabase/serverless';

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

// Initialize Neon database connection
const sql = neon(process.env.NEON_DATABASE_URL);

// Create table if it doesn't exist
const initializeDatabase = async () => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key_name VARCHAR(255) UNIQUE NOT NULL,
        encrypted_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create an index on key_name for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_api_keys_name ON api_keys(key_name)
    `;
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
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

  // Validate required environment variables
  if (!process.env.NEON_DATABASE_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database not configured' })
    };
  }

  try {
    // Initialize database on first run
    await initializeDatabase();

    const keyName = 'gemini-api-key'; // Fixed key name for this implementation

    switch (event.httpMethod) {
      case 'GET':
        // Retrieve API key
        const [keyRecord] = await sql`
          SELECT encrypted_value, updated_at 
          FROM api_keys 
          WHERE key_name = ${keyName}
        `;

        if (!keyRecord) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'API key not found' })
          };
        }

        const decryptedKey = decrypt(keyRecord.encrypted_value);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            key: decryptedKey,
            lastUpdated: keyRecord.updated_at
          })
        };

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
        
        // Use UPSERT (INSERT ... ON CONFLICT)
        await sql`
          INSERT INTO api_keys (key_name, encrypted_value, updated_at)
          VALUES (${keyName}, ${encryptedKey}, CURRENT_TIMESTAMP)
          ON CONFLICT (key_name) 
          DO UPDATE SET 
            encrypted_value = EXCLUDED.encrypted_value,
            updated_at = CURRENT_TIMESTAMP
        `;

        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'API key stored successfully' })
        };

      case 'DELETE':
        // Delete API key
        const deleteResult = await sql`
          DELETE FROM api_keys WHERE key_name = ${keyName}
        `;

        return {
          statusCode: 200,
          body: JSON.stringify({ 
            message: 'API key deleted',
            rowsAffected: deleteResult.count
          })
        };

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