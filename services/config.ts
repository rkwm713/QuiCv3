// Configuration for Google Gemini API
// For production, move the API key to environment variables

export const GEMINI_CONFIG = {
  // For development (temporary - replace with environment variable)
  API_KEY: 'AIzaSyD2RctKi3K5IO_bWt0TZGwCQPGbxTRrhmM',
  
  // For production, use:
  // API_KEY: process.env.REACT_APP_GEMINI_API_KEY || '',
  
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
  MODEL: 'gemini-2.0-flash', // Will update to gemini-2.5-pro when available
  
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 60,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // milliseconds
};

// Security recommendations:
// 1. Never commit API keys to version control
// 2. Use environment variables in production: process.env.REACT_APP_GEMINI_API_KEY
// 3. Consider using a backend proxy for additional security
// 4. Monitor API usage and set billing alerts
// 5. Restrict API key permissions in Google AI Studio

/*
To set up environment variables:

1. Create a .env file in your project root:
   REACT_APP_GEMINI_API_KEY=your_api_key_here

2. Add .env to your .gitignore file

3. Update this config to use:
   API_KEY: process.env.REACT_APP_GEMINI_API_KEY || '',

4. For production deployment:
   - Set environment variables in your hosting platform
   - Ensure the variable name starts with REACT_APP_ for Create React App
*/ 