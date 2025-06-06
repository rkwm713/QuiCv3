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
  isServerSide: boolean;
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

  private isServerSideEnvironment(): boolean {
    // Detect if we're running server-side (Netlify Functions) vs client-side
    return typeof window === 'undefined' && typeof process !== 'undefined' && !!process.env;
  }

  private loadAndValidateConfig(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isServerSide = this.isServerSideEnvironment();
    const netlifyDatabaseUrl = isServerSide ? process.env.NETLIFY_DATABASE_URL : undefined;
    
    // Determine storage type based on available configuration (server-side only)
    let storageType: 'blobs' | 'neon' | 'env-only' = 'env-only';
    if (isServerSide) {
      if (netlifyDatabaseUrl) {
        storageType = 'neon';
      } else if (process.env.ADMIN_TOKEN && process.env.ENCRYPTION_KEY) {
        storageType = 'blobs';
      }
    }
    
    const config: EnvironmentConfig = {
      nodeEnv,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
      isTest: nodeEnv === 'test',
      apiBaseUrl: this.getApiBaseUrl(nodeEnv),
      geminiApiKey: isServerSide ? process.env.GEMINI_API_KEY : undefined,
      adminToken: isServerSide ? process.env.ADMIN_TOKEN : undefined,
      encryptionKey: isServerSide ? process.env.ENCRYPTION_KEY : undefined,
      netlifyDatabaseUrl,
      storageType,
      isServerSide,
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

    // Only validate server-side variables if we're actually server-side
    if (config.isServerSide && config.isProduction) {
      if (!config.adminToken) {
        errors.push('ADMIN_TOKEN is required in production');
      }
      
      if (!config.encryptionKey) {
        errors.push('ENCRYPTION_KEY is required for secure key storage');
      }
    }

    // Client-side validation (more permissive)
    if (!config.isServerSide) {
      // Only validate what's actually needed on the client-side
      console.log('🌐 Client-side environment initialized', {
        nodeEnv: config.nodeEnv,
        apiBaseUrl: config.apiBaseUrl,
        isProduction: config.isProduction,
      });
    }

    // Warn about missing optional variables (server-side only)
    if (config.isServerSide && !config.geminiApiKey && config.isDevelopment) {
      console.warn('⚠️  GEMINI_API_KEY not found in environment variables. Using Netlify Blobs fallback.');
    }

    if (errors.length > 0) {
      const errorMessage = `Environment configuration errors:\n${errors.join('\n')}`;
      console.error('❌', errorMessage);
      throw new Error(errorMessage);
    }

    // Log successful configuration (without sensitive data)
    if (config.isServerSide) {
      console.log('✅ Server-side environment configuration validated', {
        nodeEnv: config.nodeEnv,
        apiBaseUrl: config.apiBaseUrl,
        storageType: config.storageType,
        hasGeminiKey: !!config.geminiApiKey,
        hasAdminToken: !!config.adminToken,
        hasEncryptionKey: !!config.encryptionKey,
        hasNetlifyDbUrl: !!config.netlifyDatabaseUrl,
      });
    }
  }

  public getConfig(): EnvironmentConfig {
    return { ...this.config }; // Return a copy to prevent mutations
  }

  public isSecurelyConfigured(): boolean {
    // Only check if we're server-side, client-side doesn't need these
    if (!this.config.isServerSide) {
      return true; // Client-side is always "secure" since it doesn't handle secrets
    }
    return !!(this.config.adminToken && this.config.encryptionKey);
  }

  public validateApiAccess(): void {
    // Client-side validation should be more permissive
    if (!this.config.isServerSide) {
      // Client-side just needs to know the API endpoint
      return;
    }
    
    // Server-side validation
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

// Runtime validation function (client-side safe)
export const validateEnvironment = (): void => {
  try {
    envConfig.validateApiAccess();
  } catch (error) {
    // More permissive for client-side
    if (!envConfig.getConfig().isServerSide) {
      console.warn('⚠️ Environment validation warning (client-side):', error);
      return; // Don't throw on client-side
    }
    console.error('Environment validation failed:', error);
    throw error;
  }
};

// Storage-specific validation (server-side only)
export const validateStorageConfig = (): void => {
  const config = envConfig.getConfig();
  
  // Only validate storage config server-side
  if (!config.isServerSide) {
    return;
  }
  
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