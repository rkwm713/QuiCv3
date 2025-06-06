// Environment configuration and validation utility
// This ensures all required environment variables are properly configured

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  nodeEnv: string;
  apiBaseUrl: string;
  geminiApiKey?: string; // Optional since it might come from Netlify Blobs or Neon
  adminToken?: string;
  encryptionKey?: string;
  netlifyDatabaseUrl?: string;
  storageType: 'blobs' | 'neon' | 'env-only';
}

class EnvironmentValidator {
  private static instance: EnvironmentValidator;
  private config: EnvironmentConfig;

  private constructor() {
    this.config = this.loadAndValidateConfig();
  }

  public static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }

  private loadAndValidateConfig(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const netlifyDatabaseUrl = process.env.NETLIFY_DATABASE_URL;
    
    // Determine storage type based on available configuration
    let storageType: 'blobs' | 'neon' | 'env-only' = 'env-only';
    if (netlifyDatabaseUrl) {
      storageType = 'neon';
    } else if (process.env.ADMIN_TOKEN && process.env.ENCRYPTION_KEY) {
      storageType = 'blobs';
    }
    
    const config: EnvironmentConfig = {
      nodeEnv,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
      isTest: nodeEnv === 'test',
      apiBaseUrl: this.getApiBaseUrl(nodeEnv),
      geminiApiKey: process.env.GEMINI_API_KEY,
      adminToken: process.env.ADMIN_TOKEN,
      encryptionKey: process.env.ENCRYPTION_KEY,
      netlifyDatabaseUrl,
      storageType,
    };

    this.validateConfig(config);
    return config;
  }

  private getApiBaseUrl(nodeEnv: string): string {
    if (nodeEnv === 'production') {
      return '/.netlify/functions';
    }
    
    // Development
    const port = process.env.NETLIFY_DEV_PORT || '8888';
    return `http://localhost:${port}/.netlify/functions`;
  }

  private validateConfig(config: EnvironmentConfig): void {
    const errors: string[] = [];

    // Validate required environment variables for production
    if (config.isProduction) {
      if (!config.adminToken) {
        errors.push('ADMIN_TOKEN is required in production');
      }
      
      if (!config.encryptionKey) {
        errors.push('ENCRYPTION_KEY is required for secure key storage');
      }
    }

    // Warn about missing optional variables
    if (!config.geminiApiKey && config.isDevelopment) {
      console.warn('⚠️  GEMINI_API_KEY not found in environment variables. Using Netlify Blobs fallback.');
    }

    if (errors.length > 0) {
      const errorMessage = `Environment configuration errors:\n${errors.join('\n')}`;
      console.error('❌', errorMessage);
      throw new Error(errorMessage);
    }

    // Log successful configuration (without sensitive data)
    console.log('✅ Environment configuration validated', {
      nodeEnv: config.nodeEnv,
      apiBaseUrl: config.apiBaseUrl,
      storageType: config.storageType,
      hasGeminiKey: !!config.geminiApiKey,
      hasAdminToken: !!config.adminToken,
      hasEncryptionKey: !!config.encryptionKey,
      hasNetlifyDbUrl: !!config.netlifyDatabaseUrl,
    });
  }

  public getConfig(): EnvironmentConfig {
    return { ...this.config }; // Return a copy to prevent mutations
  }

  public isSecurelyConfigured(): boolean {
    return !!(this.config.adminToken && this.config.encryptionKey);
  }

  public validateApiAccess(): void {
    if (!this.config.geminiApiKey && this.config.isDevelopment) {
      throw new Error('No Gemini API key available. Please configure GEMINI_API_KEY or set up Netlify Blobs.');
    }
  }
}

// Export singleton instance
export const envConfig = EnvironmentValidator.getInstance();

// Export specific getters for common use cases
export const getApiBaseUrl = (): string => envConfig.getConfig().apiBaseUrl;
export const isDevelopment = (): boolean => envConfig.getConfig().isDevelopment;
export const isProduction = (): boolean => envConfig.getConfig().isProduction;
export const isSecurelyConfigured = (): boolean => envConfig.isSecurelyConfigured();
export const getStorageType = (): 'blobs' | 'neon' | 'env-only' => envConfig.getConfig().storageType;
export const isNeonConfigured = (): boolean => !!envConfig.getConfig().netlifyDatabaseUrl;
export const isBlobsConfigured = (): boolean => envConfig.getConfig().storageType === 'blobs';

// Runtime validation function
export const validateEnvironment = (): void => {
  try {
    envConfig.validateApiAccess();
  } catch (error) {
    console.error('Environment validation failed:', error);
    throw error;
  }
};

// Storage-specific validation
export const validateStorageConfig = (): void => {
  const config = envConfig.getConfig();
  
  if (config.storageType === 'neon' && !config.netlifyDatabaseUrl) {
    throw new Error('Neon storage selected but NETLIFY_DATABASE_URL not configured');
  }
  
  if (config.storageType === 'blobs' && (!config.adminToken || !config.encryptionKey)) {
    throw new Error('Blobs storage selected but ADMIN_TOKEN or ENCRYPTION_KEY not configured');
  }
  
  if (config.storageType === 'env-only' && !config.geminiApiKey) {
    console.warn('⚠️  Using environment-only storage but no GEMINI_API_KEY configured');
  }
}; 