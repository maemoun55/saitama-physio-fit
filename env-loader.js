// Environment loader for frontend applications
// This script reads the .env file and injects environment variables into the frontend

(function() {
    // Function to load environment variables from .env file
    async function loadEnvironmentVariables() {
        try {
            // In a real production environment, this would be handled by a build tool
            // For development, we'll try to load from a local .env file
            const response = await fetch('./.env');
            
            if (!response.ok) {
                console.warn('Could not load .env file. Using default configuration.');
                return {};
            }
            
            const envContent = await response.text();
            const envVars = {};
            
            // Parse .env file content
            envContent.split('\n').forEach(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    const [key, ...valueParts] = line.split('=');
                    if (key && valueParts.length > 0) {
                        envVars[key.trim()] = valueParts.join('=').trim();
                    }
                }
            });
            
            return envVars;
        } catch (error) {
            console.warn('Error loading environment variables:', error);
            return {};
        }
    }
    
    // Initialize environment variables
    loadEnvironmentVariables().then(envVars => {
        // Make environment variables available globally
        window.ENV = envVars;
        
        // Dispatch event to notify that environment is loaded
        window.dispatchEvent(new CustomEvent('env-loaded', { detail: envVars }));
        
        console.log('Environment variables loaded:', Object.keys(envVars));
    });
})();