// Environment configuration for development
// This file contains the actual environment variables for development
// In production, these would be injected at build time

// Load environment variables from .env file content
window.ENV = {
    SUPABASE_URL: 'https://rbfephzobczjludtfnej.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZmVwaHpvYmN6amx1ZHRmbmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2OTg2NDUsImV4cCI6MjA2OTI3NDY0NX0.09_Z5kAr47z-MxXJg00mYVDNyRua47qns9jZntwMx8M',
    SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZmVwaHpvYmN6amx1ZHRmbmVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5ODY0NSwiZXhwIjoyMDY5Mjc0NjQ1fQ.Jjpm8h3hEqKtIxIIP4QJgnt5UpGb7s3JEUSYmmkerbc',
    SUPABASE_STORAGE_URL: 'https://rbfephzobczjludtfnej.supabase.co/storage/v1/object/public'
};

// Dispatch event to notify that environment is loaded
if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('env-loaded', { detail: window.ENV }));
    console.log('Development environment variables loaded');
}