// Environment configuration for production
// This file contains only public credentials safe for client-side use
// Sensitive keys are handled server-side or through secure environment variables

// Public Supabase configuration (safe for client-side)
window.ENV = {
    SUPABASE_URL: 'https://rbfephzobczjludtfnej.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZmVwaHpvYmN6amx1ZHRmbmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2OTg2NDUsImV4cCI6MjA2OTI3NDY0NX0.09_Z5kAr47z-MxXJg00mYVDNyRua47qns9jZntwMx8M',
    SUPABASE_STORAGE_URL: 'https://rbfephzobczjludtfnej.supabase.co/storage/v1/object/public'
};

// Note: Service role key is not included for security reasons
// It should only be used server-side or in secure environments

// Dispatch event to notify that environment is loaded
if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('env-loaded', { detail: window.ENV }));
    console.log('Development environment variables loaded');
}