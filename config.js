// Configuration loader for environment variables
// This file handles loading Supabase configuration from environment variables
// For frontend applications, environment variables need to be injected at build time

// Function to load environment variables with fallbacks
function loadConfig() {
    // In a production environment, these would be injected at build time
    // For development, we'll load from a global config object or use defaults
    
    const config = {
        SUPABASE_URL: window.ENV?.SUPABASE_URL || process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
        SUPABASE_ANON_KEY: window.ENV?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
        SUPABASE_SERVICE_KEY: window.ENV?.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY',
        SUPABASE_STORAGE_URL: window.ENV?.SUPABASE_STORAGE_URL || process.env.SUPABASE_STORAGE_URL || 'YOUR_SUPABASE_STORAGE_URL'
    };
    
    // Validate configuration
    const requiredKeys = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const missingKeys = requiredKeys.filter(key => 
        !config[key] || config[key].startsWith('YOUR_')
    );
    
    if (missingKeys.length > 0) {
        console.warn('Missing or invalid Supabase configuration for keys:', missingKeys);
        console.warn('Please ensure environment variables are properly configured.');
    }
    
    return config;
}

// Load configuration
const CONFIG = loadConfig();

// Export configuration for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}