// Saitama Physio Fit Booking System
// Data Management and Application Logic with Supabase Integration

// Notification System
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notificationSystem');
        this.content = document.getElementById('notificationContent');
        this.message = document.getElementById('notificationMessage');
        this.closeBtn = document.getElementById('notificationClose');
        
        // Initialize event listeners
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Close button event
        this.closeBtn.addEventListener('click', () => this.hideNotification());
        
        // Listen for custom events
        document.addEventListener('supabase-storage-policy-error', () => {
            this.showNotification(
                'Storage bucket creation failed due to security policy restrictions. Some file upload features may be limited.', 
                'warning',
                10000
            );
        });
    }
    
    showNotification(message, type = 'info', duration = 5000) {
        // Set message
        this.message.textContent = message;
        
        // Reset classes and add type class
        this.content.className = 'notification';
        if (['info', 'success', 'warning', 'error'].includes(type)) {
            this.content.classList.add(type);
        }
        
        // Show notification
        setTimeout(() => {
            this.content.classList.remove('hidden');
        }, 10);
        
        // Auto-hide after duration
        if (duration > 0) {
            this.autoHideTimeout = setTimeout(() => {
                this.hideNotification();
            }, duration);
        }
    }
    
    hideNotification() {
        // Clear auto-hide timeout if exists
        if (this.autoHideTimeout) {
            clearTimeout(this.autoHideTimeout);
        }
        
        // Hide notification
        this.content.classList.add('hidden');
    }
}

// Initialize notification system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.notificationSystem = new NotificationSystem();
});


// Supabase Configuration
const SUPABASE_URL = 'https://rbfephzobczjludtfnej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZmVwaHpvYmN6amx1ZHRmbmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2OTg2NDUsImV4cCI6MjA2OTI3NDY0NX0.09_Z5kAr47z-MxXJg00mYVDNyRua47qns9jZntwMx8M';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZmVwaHpvYmN6amx1ZHRmbmVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5ODY0NSwiZXhwIjoyMDY5Mjc0NjQ1fQ.Jjpm8h3hEqKtIxIIP4QJgnt5UpGb7s3JEUSYmmkerbc';

// Supabase Storage Configuration
const SUPABASE_STORAGE_URL = 'https://rbfephzobczjludtfnej.supabase.co/storage/v1/s3';
const SUPABASE_REGION = 'eu-central-1';
const STORAGE_BUCKETS = {
    PROFILES: 'user-profiles',
    COURSES: 'course-images',
    DOCUMENTS: 'documents'
};

// Initialize Supabase clients - service role for admin operations, anon for client operations
let supabase, supabaseAdmin;
if (typeof window !== 'undefined' && window.supabase && 
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    try {
        // Check if we're using Supabase v1.x or v2.x
        if (typeof window.supabase.createClient === 'function') {
            // Supabase v2.x initialization
            console.log('Using Supabase v2.x API');
            
            // Admin client with service role (full access)
            supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                },
                global: {
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY
                    },
                    fetch: {
                        timeout: 15000
                    }
                }
            });
            
            // Client with anon key (for user operations)
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true
                },
                global: {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY
                    },
                    fetch: {
                        timeout: 15000
                    }
                }
            });
        } else if (typeof window.supabase === 'function') {
            // Supabase v1.x initialization
            console.log('Using Supabase v1.x API');
            
            // Admin client with service role
            supabaseAdmin = window.supabase(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                autoRefreshToken: false,
                persistSession: false,
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY
                }
            });
            
            // Client with anon key
            supabase = window.supabase(SUPABASE_URL, SUPABASE_ANON_KEY, {
                autoRefreshToken: true,
                persistSession: true,
                headers: {
                    'apikey': SUPABASE_ANON_KEY
                }
            });
        } else {
            console.error('Error: Supabase library not properly loaded. Check version compatibility.');
            throw new Error('Supabase client initialization failed: API not available');
        }
        console.log('Supabase clients initialized successfully (admin + client)');
        
        // Make supabase client available globally for realtime integration
        window.supabaseClient = supabase;
        window.supabaseAdminClient = supabaseAdmin;
    } catch (error) {
        console.error('Error initializing Supabase clients:', error);
        // Set supabase to null to ensure we fall back to localStorage
        supabase = null;
        supabaseAdmin = null;
    }
}

// Storage Management Class
class StorageManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.maxFileSize = 5 * 1024 * 1024; // 5MB limit
        this.allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        this.allowedDocumentTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    }

    // Validate file before upload
    validateFile(file, type = 'image') {
        const errors = [];
        
        if (!file) {
            errors.push('No file selected');
            return errors;
        }
        
        if (file.size > this.maxFileSize) {
            errors.push(`File size must be less than ${this.maxFileSize / (1024 * 1024)}MB`);
        }
        
        const allowedTypes = type === 'image' ? this.allowedImageTypes : this.allowedDocumentTypes;
        if (!allowedTypes.includes(file.type)) {
            errors.push(`File type ${file.type} is not allowed`);
        }
        
        return errors;
    }

    // Generate unique filename
    generateFileName(originalName, userId = null) {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const extension = originalName.split('.').pop();
        const prefix = userId ? `user_${userId}_` : '';
        return `${prefix}${timestamp}_${randomString}.${extension}`;
    }

    // Upload file to Supabase storage
    async uploadFile(file, bucket, path = null, userId = null) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not initialized');
            }

            const fileName = this.generateFileName(file.name, userId);
            const filePath = path ? `${path}/${fileName}` : fileName;

            console.log(`Uploading file to bucket: ${bucket}, path: ${filePath}`);

            const { data, error } = await this.supabase.storage
                .from(bucket)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Upload error:', error);
                throw error;
            }

            console.log('File uploaded successfully:', data);
            return {
                success: true,
                path: data.path,
                fullPath: data.fullPath,
                fileName: fileName
            };
        } catch (error) {
            console.error('File upload failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get public URL for uploaded file
    async getPublicUrl(bucket, path) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { data } = this.supabase.storage
                .from(bucket)
                .getPublicUrl(path);

            return data.publicUrl;
        } catch (error) {
            console.error('Error getting public URL:', error);
            return null;
        }
    }

    // Delete file from storage
    async deleteFile(bucket, path) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { data, error } = await this.supabase.storage
                .from(bucket)
                .remove([path]);

            if (error) {
                throw error;
            }

            return { success: true, data };
        } catch (error) {
            console.error('File deletion failed:', error);
            return { success: false, error: error.message };
        }
    }

    // List files in bucket
    async listFiles(bucket, path = '') {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { data, error } = await this.supabase.storage
                .from(bucket)
                .list(path);

            if (error) {
                throw error;
            }

            return { success: true, files: data };
        } catch (error) {
            console.error('Error listing files:', error);
            return { success: false, error: error.message };
        }
    }

    // Create storage buckets if they don't exist
    async initializeBuckets() {
        try {
            if (!this.supabase) {
                console.warn('Supabase client not initialized, skipping bucket initialization');
                return;
            }

            // Detect Supabase version
            const isV1 = typeof window.supabase === 'function';
            console.log(`Using Supabase ${isV1 ? 'v1.x' : 'v2.x'} API for bucket operations`);

            // Skip bucket creation if we're getting row-level security policy errors
            // These errors typically mean the user doesn't have permission to create buckets
            // and the buckets should be created by an admin in the Supabase dashboard
            let skipBucketCreation = false;
            let securityPolicyErrorDetected = false;
            
            for (const [key, bucketName] of Object.entries(STORAGE_BUCKETS)) {
                try {
                    // Check for row-level security policy errors in previous operations
                    if (skipBucketCreation) {
                        console.warn(`Skipping bucket creation for ${bucketName} due to previous security policy errors`);
                        continue;
                    }
                    
                    // Try to get bucket info (this will fail if bucket doesn't exist)
                    let bucketResult;
                    try {
                        if (isV1) {
                            // Supabase v1.x API
                            bucketResult = await this.supabase.storage.getBucket(bucketName);
                        } else {
                            // Supabase v2.x API
                            bucketResult = await this.supabase.storage.getBucket(bucketName);
                        }
                        
                        const { data, error } = bucketResult;
                        
                        if (error && error.message && error.message.includes('not found')) {
                            // Bucket doesn't exist, try to create it
                            console.log(`Creating storage bucket: ${bucketName}`);
                            
                            let createResult;
                            try {
                                if (isV1) {
                                    // Supabase v1.x API
                                    createResult = await this.supabase.storage.createBucket(bucketName, {
                                        public: true
                                    });
                                } else {
                                    // Supabase v2.x API
                                    createResult = await this.supabase.storage.createBucket(bucketName, {
                                        public: true,
                                        allowedMimeTypes: key === 'PROFILES' || key === 'COURSES' ? this.allowedImageTypes : this.allowedDocumentTypes,
                                        fileSizeLimit: this.maxFileSize
                                    });
                                }
                                
                                const { data: createData, error: createError } = createResult;
                                
                                if (createError) {
                                    console.error(`Failed to create bucket ${bucketName}:`, createError);
                                    
                                    // Check for row-level security policy errors
                                    if (createError.message && createError.message.includes('row-level security policy')) {
                                        securityPolicyErrorDetected = true;
                                        console.warn('Row-level security policy error detected. You may need admin privileges to create buckets.');
                                        skipBucketCreation = true;
                                    }
                                } else {
                                    console.log(`✅ Bucket ${bucketName} created successfully`);
                                }
                            } catch (createBucketError) {
                                console.error(`Error creating bucket ${bucketName}:`, createBucketError);
                                
                                // Check for row-level security policy errors
                                if (createBucketError.message && createBucketError.message.includes('row-level security policy')) {
                                    securityPolicyErrorDetected = true;
                                    console.warn('Row-level security policy error detected. You may need admin privileges to create buckets.');
                                    skipBucketCreation = true;
                                }
                            }
                        } else if (!error) {
                            console.log(`✅ Bucket ${bucketName} already exists`);
                        }
                    } catch (bucketError) {
                        console.error(`Error with bucket ${bucketName}:`, bucketError);
                        
                        // Check for row-level security policy errors
                        if (bucketError.message && bucketError.message.includes('row-level security policy')) {
                            securityPolicyErrorDetected = true;
                            console.warn('Row-level security policy error detected. You may need admin privileges to create buckets.');
                            skipBucketCreation = true;
                        }
                    }
                } catch (error) {
                    console.error(`General error with bucket ${bucketName}:`, error);
                }
            }
            
            // Display a user-friendly message if security policy errors were detected
            if (securityPolicyErrorDetected) {
                console.info('-----------------------------------------------------------');
                console.info('STORAGE BUCKET CREATION NOTICE:');
                console.info('Row-level security policy errors were detected when trying to create storage buckets.');
                console.info('This is normal if you do not have admin privileges in the Supabase project.');
                console.info('The application will continue to function, but file upload features may be limited.');
                console.info('To resolve this:');
                console.info('1. Have an admin create the required buckets in the Supabase dashboard, or');
                console.info('2. Adjust the row-level security policies to allow bucket creation for your role.');
                console.info('-----------------------------------------------------------');
                
                // Emit an event that can be used to show a notification to the user
                const event = new CustomEvent('supabase-storage-policy-error');
                document.dispatchEvent(event);
            }
        } catch (error) {
            console.error('Error initializing storage buckets:', error);
        }
     }
}

class BookingApp {
    constructor() {
        this.currentUser = null;
        this.users = [];
        this.courses = [];
        this.bookings = [];
        this.supabaseReady = false;
        this.storageManager = null;
        this.supabase = null;
        this.supabaseAdmin = null;
        this.init();
    }

    async init() {
        await this.initializeSupabase();
        this.initializeStorageManager();
        await this.loadData();
        await this.initializeDefaultData();
        this.setupEventListeners();
        this.setupConnectionStatusIndicator();
        
        // Check for existing session via Supabase auth
        this.checkSupabaseSession();
    }

    initializeStorageManager() {
        if (this.supabaseAdmin) {
            // Use admin client for storage operations (full access)
            this.storageManager = new StorageManager(this.supabaseAdmin);
            console.log('✅ Storage Manager initialized with admin access');
            
            // Initialize storage buckets if Supabase is ready
            if (this.supabaseReady) {
                this.storageManager.initializeBuckets();
            }
        } else {
            console.warn('⚠️ Storage Manager not initialized - Supabase admin client unavailable');
        }
    }
    
    setupConnectionStatusIndicator() {
        // Create a status indicator element
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'connection-status';
        statusIndicator.style.position = 'fixed';
        statusIndicator.style.bottom = '10px';
        statusIndicator.style.right = '10px';
        statusIndicator.style.padding = '5px 10px';
        statusIndicator.style.borderRadius = '4px';
        statusIndicator.style.fontSize = '12px';
        statusIndicator.style.fontWeight = 'bold';
        statusIndicator.style.zIndex = '1000';
        statusIndicator.style.display = 'none'; // Hidden by default
        
        // Update the status indicator based on Supabase connection
        if (!this.supabaseReady) {
            statusIndicator.textContent = '❌ Database Connection Error';
            statusIndicator.style.backgroundColor = '#F8D7DA';
            statusIndicator.style.color = '#721C24';
            statusIndicator.style.border = '1px solid #F5C6CB';
            statusIndicator.style.display = 'block';
        }
        
        // Add the indicator to the document body
        document.body.appendChild(statusIndicator);
        
        // Listen for connection status changes
        document.addEventListener('supabase-save-error', () => {
            statusIndicator.textContent = '🔄 Offline Mode - Using Local Storage';
            statusIndicator.style.backgroundColor = '#FFF3CD';
            statusIndicator.style.color = '#856404';
            statusIndicator.style.border = '1px solid #FFEEBA';
            statusIndicator.style.display = 'block';
        });
        
        document.addEventListener('supabase-save-success', () => {
            // Hide the indicator after successful save
            setTimeout(() => {
                statusIndicator.style.display = 'none';
            }, 3000);
        });
        
        // Add retry button for reconnection
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry Connection';
        retryButton.style.marginLeft = '10px';
        retryButton.style.padding = '2px 5px';
        retryButton.style.backgroundColor = '#007BFF';
        retryButton.style.color = 'white';
        retryButton.style.border = 'none';
        retryButton.style.borderRadius = '3px';
        retryButton.style.cursor = 'pointer';
        
        retryButton.addEventListener('click', async () => {
            retryButton.textContent = 'Connecting...';
            retryButton.disabled = true;
            
            // Attempt to reconnect to Supabase
            await this.initializeSupabase();
            
            if (this.supabaseReady) {
                statusIndicator.textContent = '✅ Connected to Supabase';
                statusIndicator.style.backgroundColor = '#D4EDDA';
                statusIndicator.style.color = '#155724';
                statusIndicator.style.border = '1px solid #C3E6CB';
                
                // Hide after 3 seconds
                setTimeout(() => {
                    statusIndicator.style.display = 'none';
                }, 3000);
            } else {
                statusIndicator.textContent = '❌ Database Connection Error';
                statusIndicator.style.backgroundColor = '#F8D7DA';
                statusIndicator.style.color = '#721C24';
                statusIndicator.style.border = '1px solid #F5C6CB';
            }
            
            retryButton.textContent = 'Retry Connection';
            retryButton.disabled = false;
        });
        
        statusIndicator.appendChild(retryButton);
    }

    async initializeSupabase() {
        if (!supabase) {
            console.log('Supabase not configured, using localStorage');
            this.supabaseReady = false;
            return;
        }
        
        // Set instance properties from global variables
        this.supabase = supabase;
        this.supabaseAdmin = supabaseAdmin;
        
        console.log('DEBUG: Setting Supabase clients:', {
            supabase: !!supabase,
            supabaseAdmin: !!supabaseAdmin,
            thisSupabase: !!this.supabase,
            thisSupabaseAdmin: !!this.supabaseAdmin
        });
        
        console.log('Testing Supabase connection...');
        console.log('Supabase URL:', SUPABASE_URL);
        console.log('Supabase client initialized:', !!supabase);
        
        try {
            // Detect Supabase version
            const isV1 = typeof window.supabase === 'function';
            console.log(`Using Supabase ${isV1 ? 'v1.x' : 'v2.x'} API for queries`);
            
            // For v1.x, we don't need to check for supabase.from as it's always available
            if (!isV1 && (!supabase.from || typeof supabase.from !== 'function')) {
                throw new Error('TypeError: Supabase client methods are not available. Check Supabase library version.');
            }
            
            // Test connection with a simpler query first
            console.log('Attempting to connect to Supabase...');
            
            // Add timeout to prevent hanging requests
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout')), 10000)
            );
            
            // Check if Supabase is available by making a simple request
            // Use a more reliable endpoint that doesn't require authentication
            const healthCheckPromise = fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY
                }
            }).then(response => {
                if (!response.ok) {
                    throw new Error(`Supabase health check failed: ${response.status}`);
                }
                return response.json();
            });
            
            try {
                await Promise.race([healthCheckPromise, timeoutPromise]);
                console.log('✅ Supabase API is reachable');
                
                // Now try to query the users table
                try {
                    let result;
                    if (isV1) {
                        // Supabase v1.x API
                        result = await supabase
                            .from('users')
                            .select('*')
                            .limit(1);
                    } else {
                        // Supabase v2.x API
                        result = await supabase.from('users').select('*', { count: 'exact', head: true });
                    }
                    
                    console.log('Supabase test result:', result);
                    
                    if (!result.error) {
                        this.supabaseReady = true;
                        console.log('✅ Supabase connection established successfully');
                    } else {
                        console.error('❌ Supabase tables not accessible:', result.error);
                        console.log('Error details:', {
                            message: result.error.message,
                            details: result.error.details,
                            hint: result.error.hint,
                            code: result.error.code
                        });
                        console.log('This might be because:');
                        console.log('1. Tables have not been created in Supabase yet');
                        console.log('2. Row Level Security (RLS) is blocking access');
                        console.log('3. API key permissions are insufficient');
                        console.log('Falling back to localStorage mode');
                        this.supabaseReady = false;
                    }
                } catch (tableError) {
                    console.error('❌ Supabase table query error:', tableError);
                    console.log('Error type:', tableError.name);
                    console.log('Error message:', tableError.message);
                    console.log('Falling back to localStorage mode');
                    this.supabaseReady = false;
                }
            } catch (queryError) {
                console.error('❌ Supabase query failed:', queryError);
                console.log('Falling back to localStorage mode');
                this.supabaseReady = false;
            }
        } catch (error) {
            console.error('❌ Supabase connection failed:', error);
            console.log('Error type:', error.name);
            console.log('Error message:', error.message);
            if (error.message && error.message.includes('TypeError')) {
                console.log('🔍 TypeError detected. This usually means:');
                console.log('1. Incompatible Supabase library version');
                console.log('2. Supabase client was not properly initialized');
                console.log('3. The Supabase library is missing required methods');
            } else if (error.message && error.message.includes('ERR_ABORTED')) {
                console.log('🔍 Network request was aborted. This usually means:');
                console.log('1. CORS policy is blocking the request');
                console.log('2. The Supabase project is paused or doesn\'t exist');
                console.log('3. Network connectivity issues');
                console.log('4. API key is invalid or expired');
                console.log('5. Supabase service might be experiencing issues');
            }
            console.log('Falling back to localStorage mode');
            this.supabaseReady = false;
        }
    }

    async createTables() {
        if (!this.supabaseAdmin) {
            console.log('Supabase admin client not available. Please create tables manually in Supabase dashboard:');
            console.log('1. users (id, first_name, last_name, email, username, password, role, created_at)');
            console.log('2. courses (id, name, time, date, date_display, day_of_week, created_at)');
            console.log('3. bookings (id, user_id, course_id, status, timestamp, cancellation_date, created_at)');
            return;
        }

        try {
            console.log('Creating database tables...');
            
            // Create users table
            await this.createUsersTable();
            
            // Create courses table
            await this.createCoursesTable();
            
            // Create bookings table
            await this.createBookingsTable();
            
            console.log('All tables created successfully!');
        } catch (error) {
            console.error('Error creating tables:', error);
            console.log('Please create tables manually in Supabase dashboard if automatic creation failed.');
        }
    }

    async createUsersTable() {
        const { error } = await this.supabaseAdmin.rpc('create_users_table_if_not_exists');
        if (error) {
            console.error('Error creating users table:', error);
            throw error;
        }
        console.log('Users table created/verified');
    }

    async createCoursesTable() {
        const { error } = await this.supabaseAdmin.rpc('create_courses_table_if_not_exists');
        if (error) {
            console.error('Error creating courses table:', error);
            throw error;
        }
        console.log('Courses table created/verified');
    }

    async createBookingsTable() {
        const { error } = await this.supabaseAdmin.rpc('create_bookings_table_if_not_exists');
        if (error) {
            console.error('Error creating bookings table:', error);
            throw error;
        }
        console.log('Bookings table created/verified');
    }
    
    // Data Management
    async loadData() {
        if (!this.supabaseReady) {
            console.error('Supabase connection not ready - cannot load data');
            throw new Error('Database connection not available. Please check your internet connection.');
        }
        await this.loadFromSupabase();
    }

    loadFromLocalStorage() {
        // Deprecated - no longer used, data loads from Supabase only
        console.warn('loadFromLocalStorage called - this method is deprecated');
        this.users = [];
        this.courses = [];
        this.bookings = [];
    }

    async loadFromSupabase() {
        try {
            console.log('Attempting to load data from Supabase...');
            
            // Check Supabase connection first
            if (!this.supabaseReady || !this.supabaseAdmin) {
                console.error('Supabase connection not ready - cannot load data');
                throw new Error('Database connection not available. Please check your internet connection.');
            }
            
            // Detect Supabase version
            const isV1 = typeof window.supabase === 'function';
            console.log(`Using Supabase ${isV1 ? 'v1.x' : 'v2.x'} API for data loading`);
            
            // Load users and courses in parallel to ensure they are available for booking processing
            await Promise.all([
                (async () => {
                    try {
                        const { data: users, error } = await this.supabaseAdmin.from('users').select('*');
                        if (error) throw error;
                        this.users = (users || []).map(user => ({ ...user, firstName: user.first_name, lastName: user.last_name }));
                        console.log(`Successfully loaded ${this.users.length} users from Supabase`);
                    } catch (error) {
                        console.error('Failed to load users from Supabase:', error);
                        this.users = [];
                    }
                })(),
                (async () => {
                    try {
                        const { data: courses, error } = await this.supabaseAdmin.from('courses').select('*');
                        if (error) throw error;
                        this.courses = courses || [];
                        console.log(`Successfully loaded ${this.courses.length} courses from Supabase`);
                    } catch (error) {
                        console.error('Failed to load courses from Supabase:', error);
                        this.courses = [];
                    }
                })()
            ]);

            // Now load bookings, ensuring users and courses are already loaded
            try {
                const { data: bookings, error: bookingsError } = await this.supabaseAdmin.from('bookings').select('*');
                if (bookingsError) {
                    console.error('Error loading bookings:', bookingsError);
                    throw bookingsError;
                }
                
                // Add compatibility fields for bookings
                this.bookings = (bookings || []).map(booking => {
                    console.log('Processing booking from Supabase:', booking);
                    const processedBooking = {
                        ...booking,
                        userId: booking.user_id,
                        courseId: booking.course_id
                    };
                    
                    // Find the corresponding course to get current data
                    const course = this.courses.find(c => c.id === booking.course_id);
                    if (course) {
                        processedBooking.courseData = {
                            name: course.name,
                            date_display: course.date_display,
                            time: course.time,
                            date: course.date
                        };
                        processedBooking.courseName = course.name;
                        processedBooking.courseDate = course.date_display;
                        processedBooking.courseTime = course.time;
                    } else {
                        // Fallback for missing course data
                        processedBooking.courseData = null;
                        processedBooking.courseName = booking.course_name || 'Unknown Course';
                        processedBooking.courseDate = booking.course_date || 'Unknown Date';
                        processedBooking.courseTime = booking.course_time || 'Unknown Time';
                    }
                    
                    console.log('Processed booking:', processedBooking);
                    return processedBooking;
                });
                console.log(`Successfully loaded ${this.bookings.length} bookings from Supabase`);
                console.log('Final bookings array:', this.bookings);
            } catch (bookingError) {
                console.error('Failed to load bookings from Supabase:', bookingError);
                this.bookings = [];
                console.warn('Using empty bookings array as fallback');
            }

        } catch (error) {
            console.error('Error loading data from Supabase:', error);
            throw new Error('Failed to load data from database: ' + error.message);
        }
    }

    async saveData() {
        if (!this.supabaseReady) {
            console.warn('Supabase not ready - data will not be saved');
            throw new Error('Database connection not available. Please check your internet connection.');
        }
        await this.saveToSupabase();
    }

    saveToLocalStorage() {
        // Deprecated - no longer used, data saves to Supabase only
        console.warn('saveToLocalStorage called - this method is deprecated');
    }

    async saveToSupabase() {
        // Check if Supabase is ready before attempting to save
        if (!this.supabaseReady) {
            console.warn('Supabase connection not ready - cannot save data');
            throw new Error('Database connection not available. Please check your internet connection.');
        }
        
        console.log('🔄 Attempting to save data to Supabase...');
        
        try {
            // Detect Supabase version
            const isV1 = typeof window.supabase === 'function';
            console.log(`Using Supabase ${isV1 ? 'v1.x' : 'v2.x'} API for saving data`);
            
            // Save bookings to Supabase
            if (this.bookings && this.bookings.length > 0) {
                console.log('💾 Saving bookings to Supabase:', this.bookings.length);
                
                // Prepare bookings for Supabase (clean format)
                const supabaseBookings = this.bookings.map(booking => ({
                    id: booking.id,
                    user_id: booking.userId || booking.user_id,
                    course_id: booking.courseId || booking.course_id,
                    status: booking.status,
                    timestamp: booking.timestamp,
                    cancellation_date: booking.cancellation_date || null
                }));
                
                // Use upsert to handle both inserts and updates
                let result;
                if (isV1) {
                    // Supabase v1.x API
                    result = await this.supabaseAdmin
                        .from('bookings')
                        .upsert(supabaseBookings, { onConflict: 'id' });
                } else {
                    // Supabase v2.x API
                    result = await this.supabaseAdmin
                        .from('bookings')
                        .upsert(supabaseBookings, { onConflict: 'id' })
                        .select();
                }
                
                const { data, error } = result;
                if (error) {
                    console.error('❌ Error saving bookings to Supabase:', error);
                    throw error;
                }
                
                console.log('✅ Bookings saved to Supabase successfully:', data?.length || supabaseBookings.length);
            }
            
            console.log('✅ All data saved to Supabase successfully');
            
            // Emit an event that data was saved successfully
            const event = new CustomEvent('supabase-save-success');
            document.dispatchEvent(event);
        } catch (error) {
            console.error('❌ Error saving data to Supabase:', error);
            
            // Emit an event that data save failed
            const event = new CustomEvent('supabase-save-error', { detail: error });
            document.dispatchEvent(event);
            
            // Re-throw the error so calling functions know it failed
            throw error;
        }
    }

    async initializeDefaultData() {
        // Initialize default users if none exist
        if (this.users.length === 0) {
            const defaultUsers = [
                { id: 1, first_name: 'Admin', last_name: 'User', email: 'admin@saitama.com', username: 'admin', password: 'admin123', role: 'Admin' },
                { id: 2, first_name: 'John', last_name: 'Doe', email: 'john.doe@email.com', username: 'member1', password: 'member123', role: 'Member' },
                { id: 3, first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@email.com', username: 'member2', password: 'member456', role: 'Member' }
            ];
            
            if (this.supabaseReady) {
                await this.insertDefaultUsers(defaultUsers);
            } else {
                // Convert to old format for localStorage compatibility
                this.users = defaultUsers.map(user => ({
                    ...user,
                    firstName: user.first_name,
                    lastName: user.last_name
                }));
            }
        }

        // Generate daily courses for the next 4 weeks
        const generatedCourses = await this.generateDailyCourses();
        if (this.courses.length === 0) {
            if (this.supabaseReady) {
                await this.insertDefaultCourses(generatedCourses);
                // Update this.courses with the courses from database
                this.courses = generatedCourses;
            } else {
                this.courses = generatedCourses;
            }
        }
        
        await this.saveData();
    }

    async insertDefaultUsers(users) {
        try {
            // Create clean objects with only database column names
            const supabaseUsers = users.map(user => ({
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                username: user.username,
                password: user.password,
                role: user.role
            }));
            
            // Detect Supabase version
            const isV1 = typeof window.supabase === 'function';
            console.log(`Using Supabase ${isV1 ? 'v1.x' : 'v2.x'} API for inserting users`);
            
            let result;
            if (isV1) {
                // Supabase v1.x API
                result = await supabase
                    .from('users')
                    .insert(supabaseUsers);
            } else {
                // Supabase v2.x API
                result = await supabase
                    .from('users')
                    .insert(supabaseUsers)
                    .select();
            }
            
            const { data, error } = result;
            if (error) throw error;
            this.users = data || supabaseUsers; // Use inserted data if available, otherwise use the input data
        } catch (error) {
            console.error('Error inserting default users:', error);
            // Fallback to localStorage format
            this.users = users.map(user => ({
                ...user,
                firstName: user.first_name,
                lastName: user.last_name
            }));
        }
    }

    async insertDefaultCourses(courses) {
        try {
            console.log('=== COURSE INSERT DEBUG ===');
            console.log('Attempting to insert courses:', courses.length);
            console.log('Sample course data:', courses[0]);
            
            // Create clean objects with only database column names
            const supabaseCourses = courses.map(course => ({
                id: course.id,
                name: course.name,
                time: course.time,
                date: course.date,
                date_display: course.date_display,
                day_of_week: course.day_of_week
            }));
            
            console.log('Cleaned courses for Supabase:', supabaseCourses.length);
            console.log('Sample cleaned course:', supabaseCourses[0]);
            
            // Detect Supabase version
            const isV1 = typeof window.supabase === 'function';
            console.log(`Using Supabase ${isV1 ? 'v1.x' : 'v2.x'} API for inserting courses`);
            
            let result;
            if (isV1) {
                // Supabase v1.x API
                result = await this.supabaseAdmin
                    .from('courses')
                    .insert(supabaseCourses);
            } else {
                // Supabase v2.x API
                result = await this.supabaseAdmin
                    .from('courses')
                    .insert(supabaseCourses)
                    .select();
            }
            
            const { data, error } = result;
            console.log('Course insert response - data:', data, 'error:', error);
            
            if (error) {
                console.error('Course insert error details:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                });
                throw error;
            }
            
            this.courses = data || supabaseCourses; // Use inserted data if available, otherwise use the input data
            console.log('Successfully inserted courses. Final course count:', this.courses.length);
            console.log('===========================');
        } catch (error) {
            console.error('Error inserting default courses:', error);
            this.courses = courses;
        }
    }

    // Function to check if a date is a German holiday
    isGermanHoliday(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // JavaScript months are 0-indexed
        const day = date.getDate();
        
        // Fixed holidays
        const fixedHolidays = [
            { month: 1, day: 1 },   // New Year's Day
            { month: 5, day: 1 },   // Labour Day
            { month: 10, day: 3 },  // German Unity Day
            { month: 12, day: 25 }, // Christmas Day
            { month: 12, day: 26 }  // Boxing Day
        ];
        
        // Check fixed holidays
        for (const holiday of fixedHolidays) {
            if (month === holiday.month && day === holiday.day) {
                return true;
            }
        }
        
        // Calculate Easter Sunday for variable holidays
        const easter = this.calculateEaster(year);
        const easterMonth = easter.getMonth() + 1;
        const easterDay = easter.getDate();
        
        // Variable holidays based on Easter
        const variableHolidays = [
            { month: easterMonth, day: easterDay - 2 },     // Good Friday
            { month: easterMonth, day: easterDay + 1 },     // Easter Monday
            { month: easterMonth, day: easterDay + 39 },    // Ascension Day
            { month: easterMonth, day: easterDay + 50 }     // Whit Monday
        ];
        
        // Check variable holidays (handle month overflow)
        for (const holiday of variableHolidays) {
            let holidayDate = new Date(year, easter.getMonth(), easterDay + (holiday.day - easterDay));
            if (holidayDate.getMonth() + 1 === month && holidayDate.getDate() === day) {
                return true;
            }
        }
        
        return false;
    }
    
    // Calculate Easter Sunday using the algorithm
    calculateEaster(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const n = Math.floor((h + l - 7 * m + 114) / 31);
        const p = (h + l - 7 * m + 114) % 31;
        return new Date(year, n - 1, p + 1);
    }

    async generateDailyCourses() {
        const courses = [];
        const today = new Date();
        const weeklySchedule = {
            1: [ // Monday
                { time: '08:45–09:30', name: 'Fle.xx' },
                { time: '09:45–10:30', name: 'Fle.xx' },
                { time: '16:30–17:15', name: 'Fle.xx' },
                { time: '17:30–18:15', name: 'Fle.xx' }
            ],
            2: [ // Tuesday
                { time: '09:30–10:15', name: 'Fle.xx' },
                { time: '17:00–17:45', name: 'Fle.xx' },
                { time: '18:00–18:45', name: 'TRX' },
                { time: '19:00–19:45', name: 'TRX' }
            ],
            3: [ // Wednesday
                { time: '08:45–09:00', name: 'Fle.xx' },
                { time: '09:45–10:30', name: 'Fle.xx' },
                { time: '17:15–18:00', name: 'Fle.xx' },
                { time: '18:15–19:00', name: 'Fle.xx' }
            ],
            4: [ // Thursday
                { time: '18:15–19:00', name: 'Bauch, Beine, Po' },
                { time: '19:00–20:00', name: 'Vinyasa Power Yoga' }
            ],
            5: [ // Friday
                { time: '08:45–09:30', name: 'Fle.xx' },
                { time: '09:45–10:30', name: 'Fle.xx' }
            ]
        };
        
        // Generate courses for the next 4 weeks (28 days)
        for (let dayOffset = 0; dayOffset < 28; dayOffset++) {
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + dayOffset);
            
            // Reset time to start of day for proper comparison
            const todayStart = new Date(today);
            todayStart.setHours(0, 0, 0, 0);
            currentDate.setHours(0, 0, 0, 0);
            
            // Skip past dates (only show today and future courses)
            if (currentDate < todayStart) continue;
            
            const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
            
            // Skip weekends (Saturday = 6, Sunday = 0)
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            
            // Skip German holidays
            if (this.isGermanHoliday(currentDate)) continue;
            
            const daySchedule = weeklySchedule[dayOfWeek];
            if (daySchedule) {
                daySchedule.forEach(session => {
                    const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                    // Create truly deterministic ID using date string, time, and session name
                    const timeComponents = session.time.split('–')[0].split(':').map(Number);
                    const hours = timeComponents[0];
                    const minutes = timeComponents[1] || 0;
                    const timeInMinutes = hours * 60 + minutes;
                    
                    // Create a simple hash from the combination of date, time, and session name
                    const idString = `${dateStr}-${timeInMinutes}-${session.name}`;
                    let hash = 0;
                    for (let i = 0; i < idString.length; i++) {
                        const char = idString.charCodeAt(i);
                        hash = ((hash << 5) - hash) + char;
                        hash = hash & hash; // Convert to 32-bit integer
                    }
                    const stableId = Math.abs(hash);
                    
                    courses.push({
                        id: stableId,
                        name: session.name,
                        time: session.time,
                        date: dateStr,
                        date_display: currentDate.toLocaleDateString('de-DE', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        }),
                        day_of_week: currentDate.toLocaleDateString('de-DE', { weekday: 'long' })
                    });
                });
            }
        }
        
        try {
            // Check if Supabase is available
            if (this.supabaseReady && this.supabaseAdmin) {
                // First, remove ALL existing courses to prevent duplicates with new ID system
                const { error: clearError } = await this.supabaseAdmin
                    .from('courses')
                    .delete()
                    .neq('id', 0); // Delete all courses
                
                if (clearError) {
                    console.warn('Error clearing existing courses:', clearError);
                }
                
                console.log('Cleared all existing courses to prevent duplicates with new ID system');
                
                // Remove past courses from the database (for future runs)
                const todayStr = today.toISOString().split('T')[0];

                // Insert all newly generated courses with deterministic IDs
                if (courses.length > 0) {
                    const { error: insertError } = await this.supabaseAdmin
                        .from('courses')
                        .insert(courses);

                    if (insertError) {
                        console.warn('Error inserting courses:', insertError);
                        // Try individual inserts as fallback
                        for (const course of courses) {
                            try {
                                await this.supabaseAdmin
                                    .from('courses')
                                    .insert([course]);
                            } catch (individualError) {
                                console.warn(`Failed to insert course ${course.id}:`, individualError);
                            }
                        }
                    } else {
                        console.log(`${courses.length} courses have been inserted with new deterministic IDs.`);
                    }
                }

                // Fetch all courses to populate the app state
                const { data: allCourses, error: finalFetchError } = await this.supabaseAdmin
                    .from('courses')
                    .select('*')
                    .order('date', { ascending: true });
                if (finalFetchError) throw finalFetchError;

                console.log('Fetched courses from database after insertion:', allCourses?.length || 0);
                console.log('Sample course from DB:', allCourses?.[0]);
                
                // CRITICAL: Update the app's course array with the database courses
                this.courses = allCourses || [];
                
                return allCourses;
            } else {
                console.warn('Supabase not ready, using locally generated courses');
                return courses;
            }

        } catch (error) {
            console.error('Error synchronizing daily courses with Supabase:', error);
            // Fallback to locally generated courses if Supabase fails
            return courses;
        }
    }

    async checkSupabaseSession() {
        if (!this.supabaseReady) {
            this.showLoginScreen();
            return;
        }
        
        try {
            // Check if user is already logged in via Supabase auth
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (user && !error) {
                // Get additional user data from users table
                const { data: userData } = await this.supabaseAdmin
                    .from('users')
                    .select('*')
                    .eq('email', user.email)
                    .single();
                
                if (userData) {
                    this.currentUser = userData;
                    if (userData.first_name) {
                        this.currentUser.firstName = userData.first_name;
                        this.currentUser.lastName = userData.last_name;
                    }
                    await this.showMainScreen();
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
        
        this.showLoginScreen();
    }

    // Authentication
    async login(email, password) {
        if (!this.supabaseReady) {
            console.error('Supabase not ready for login');
            return false;
        }
        
        try {
            // Use Supabase auth for login
            const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (authError) {
                console.error('Auth login error:', authError);
                return false;
            }
            
            if (authData.user) {
                // Get user data from users table
                const { data: userData, error: userError } = await this.supabaseAdmin
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .single();
                
                if (userData && !userError) {
                    this.currentUser = userData;
                    if (userData.first_name) {
                        this.currentUser.firstName = userData.first_name;
                        this.currentUser.lastName = userData.last_name;
                    }
                    await this.showMainScreen();
                    return true;
                }
            }
        } catch (error) {
            console.error('Login error:', error);
        }
        
        return false;
    }

    async logout() {
        this.currentUser = null;
        
        // Sign out from Supabase auth
        if (this.supabaseReady) {
            try {
                await this.supabase.auth.signOut();
            } catch (error) {
                console.error('Error signing out:', error);
            }
        }
        
        this.showLoginScreen();
    }

    // Screen Management
    showLoginScreen() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('mainScreen').classList.remove('active');
        document.getElementById('loginForm').reset();
    }

    async showMainScreen() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('mainScreen').classList.add('active');
        
        // Safe property access for user name display
        const firstName = this.currentUser?.firstName || this.currentUser?.first_name || 'User';
        const lastName = this.currentUser?.lastName || this.currentUser?.last_name || '';
        document.getElementById('welcomeUser').textContent = `Welcome, ${firstName} ${lastName}`.trim();
        
        // Ensure courses are loaded from Supabase and generate if needed
        console.log('DEBUG: Ensuring courses are available...');
        try {
            // First, try to load existing courses from Supabase
            const { data: existingCourses, error } = await this.supabaseAdmin
                .from('courses')
                .select('*');
            
            if (error) {
                console.error('Error loading courses:', error);
            }
            
            // If no courses exist, generate them
            if (!existingCourses || existingCourses.length === 0) {
                console.log('DEBUG: No courses found, generating new ones...');
                this.courses = await this.generateDailyCourses();
            } else {
                console.log(`DEBUG: Found ${existingCourses.length} existing courses in database`);
                this.courses = existingCourses;
            }
        } catch (error) {
            console.error('Error ensuring courses:', error);
            // Fallback to generating courses
            this.courses = await this.generateDailyCourses();
        }
        
        await this.saveData();
        
        // Show/hide tabs based on role
        const adminTab = document.querySelector('.admin-only');
        const memberTabs = document.querySelectorAll('.member-only');
        
        // Debug: Show current user role
        alert(`Current user role: ${this.currentUser.role}. Admin panel will be ${this.currentUser.role === 'Admin' ? 'visible' : 'hidden'}`);
        
        if (this.currentUser.role === 'Admin') {
            adminTab.style.display = 'block';
            memberTabs.forEach(tab => tab.style.display = 'none');
            this.showTab('admin');
            this.renderAllBookings();
            this.renderAllUsers();

            // Initialize real-time system for admins
            if (this.supabaseReady && !this.realtimeSystem) {
                this.realtimeSystem = new RealtimeBookingSystem(this.bookings, this.users, this.courses);
            }
        } else {
            adminTab.style.display = 'none';
            memberTabs.forEach(tab => tab.style.display = 'block');
            this.showTab('courses');
            await this.renderCourses();
            this.renderUserBookings();
        }
    }

    showTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(tabName + 'Tab').classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    showAdminTab(tabName) {
        // Debug alert to check if function is called
        alert(`showAdminTab called with: ${tabName}`);
        
        // Hide all admin tab contents
        document.querySelectorAll('.admin-tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all admin tab buttons
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected admin tab
        document.getElementById('admin' + tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Tab').classList.add('active');
        document.querySelector(`[data-admin-tab="${tabName}"]`).classList.add('active');
        
        // Render content based on tab
        if (tabName === 'bookings') {
            this.renderAllBookings();
        } else if (tabName === 'pending') {
            this.renderPendingBookings();
        } else if (tabName === 'waitinglist') {
            this.renderWaitingListBookings();
        } else if (tabName === 'cancellations') {
            this.renderCancelledBookings();
        } else if (tabName === 'users') {
            this.renderAllUsers();
        }
    }

    // Course Management
    async renderCourses() {
        // Load courses from Supabase to ensure we use the correct IDs
        console.log('DEBUG: Loading courses from Supabase for rendering...');
        try {
            const { data: dbCourses, error } = await this.supabaseAdmin
                .from('courses')
                .select('*')
                .order('date', { ascending: true })
                .order('time', { ascending: true });
            
            if (error) {
                console.error('Error loading courses from Supabase:', error);
                // Fallback to existing courses
            } else {
                this.courses = dbCourses || [];
                console.log(`DEBUG: Loaded ${this.courses.length} courses from Supabase for rendering`);
                console.log('DEBUG: Sample course IDs:', this.courses.slice(0, 3).map(c => c.id));
            }
        } catch (error) {
            console.error('Failed to load courses from Supabase:', error);
        }
        
        const coursesGrid = document.getElementById('coursesGrid');
        coursesGrid.innerHTML = '';
        
        if (this.courses.length === 0) {
            coursesGrid.innerHTML = `
                <div class="empty-state">
                    <h4>No Upcoming Courses</h4>
                    <p>No courses are scheduled for the next 4 weeks.</p>
                </div>
            `;
            return;
        }
        
        // Group courses by date for better organization
        const coursesByDate = {};
        this.courses.forEach(course => {
            if (!coursesByDate[course.date]) {
                coursesByDate[course.date] = [];
            }
            coursesByDate[course.date].push(course);
        });
        
        // Render courses grouped by date
        Object.keys(coursesByDate).sort().forEach(date => {
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            dateHeader.innerHTML = `<h3>${coursesByDate[date][0].date_display}</h3>`;
            coursesGrid.appendChild(dateHeader);
            
            const dayCoursesGrid = document.createElement('div');
            dayCoursesGrid.className = 'day-courses-grid';
            
            coursesByDate[date].forEach(course => {
                const userBooking = this.bookings.find(b => 
                    b.userId === this.currentUser.id && 
                    b.courseId === course.id && 
                    (b.status === 'Pending' || b.status === 'Confirmed' || b.status === 'Waiting List')
                );
                
                const courseCard = document.createElement('div');
                courseCard.className = 'course-card';
                
                // Determine status class based on booking status
                let statusClass = 'status-available';
                if (userBooking) {
                    if (userBooking.status === 'Waiting List') {
                        statusClass = 'status-waiting-list';
                    } else {
                        statusClass = 'status-booked';
                    }
                }
                
                courseCard.innerHTML = `
                    <h4>${course.name}</h4>
                    <div class="course-time">
                        <strong>Time:</strong> ${course.time}
                    </div>
                    <div class="course-status ${statusClass}">
                        ${userBooking ? `Booked (${userBooking.status})` : 'Available'}
                    </div>
                    <button class="btn-primary" onclick="app.handleBookCourse('${course.id}')"
                                ${userBooking ? 'disabled' : ''}>
                            ${userBooking ? 'Already Booked' : 'Book Now'}
                        </button>
                `;
                dayCoursesGrid.appendChild(courseCard);
            });
            
            coursesGrid.appendChild(dayCoursesGrid);
        });
    }

        handleBookCourse(courseId) {
        // Ensure courseId is treated as a number
        const id = Number(courseId);
        this.bookCourse(id);
    }

    async bookCourse(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        const existingBooking = this.bookings.find(b => 
            b.userId === this.currentUser.id && 
            b.courseId === courseId && 
            (b.status === 'Pending' || b.status === 'Confirmed' || b.status === 'Waiting List')
        );
        
        if (existingBooking) {
            alert('You already have a booking for this course.');
            return;
        }
        
        try {
            await this.createBooking(courseId);
        } catch (error) {
            console.error('Error booking course:', error);
            alert('Failed to book course. Please try again.');
        }
    }

    async createBooking(courseId) {
        console.log('Creating booking for course:', courseId);
        console.log('Current user:', this.currentUser?.id);
        
        // Ensure Supabase is ready - no local fallback
        if (!this.supabaseReady || !this.supabaseAdmin) {
            alert('Database connection not available. Please check your internet connection and try again.');
            return;
        }
        
        const course = this.courses.find(c => c.id === courseId);
        
        try {
            // First, verify the course exists in the database
            console.log('Checking if course exists in Supabase:', courseId, 'as number:', Number(courseId));
            const { data: courseExists, error: courseCheckError } = await this.supabaseAdmin
                .from('courses')
                .select('id')
                .eq('id', Number(courseId));
            
            console.log('Course check result:', { courseExists, courseCheckError });
            
            if (courseCheckError) {
                console.error('Course check error:', courseCheckError);
                    throw new Error(`Error checking course existence: ${courseCheckError.message}`);
            }
            
            if (!courseExists || courseExists.length === 0) {
                console.error('Course not found in database. Available courses:');
                const { data: allCourses } = await this.supabaseAdmin.from('courses').select('id, name');
                console.log('All courses in DB:', allCourses);
                throw new Error(`Course with ID ${courseId} does not exist in the database. Please refresh the page to sync courses.`);
            }
            
            // Only send database-compatible fields to Supabase
            const supabaseBooking = {
                user_id: this.currentUser.id,
                course_id: Number(courseId), // Ensure course_id is a number
                status: 'Pending',
                timestamp: new Date().toISOString()
            };
            
            console.log('Attempting to insert booking:', supabaseBooking);
            
            const { data, error } = await this.supabaseAdmin
                .from('bookings')
                .insert([supabaseBooking])
                .select()
                .single();
            
            console.log('Supabase insert response - data:', data, 'error:', error);
            
            if (error) {
                console.error('Supabase insert error details:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                });
                throw error;
            }
            
            if (!data) {
                console.error('No data returned from Supabase insert');
                throw new Error('No data returned from Supabase insert');
            }
            
            // Add compatibility fields and ensure ID is set
            data.userId = data.user_id;
            data.courseId = data.course_id;
            data.id = data.id || Date.now(); // Ensure ID exists
            
            // Add course data for display (stored locally, not in Supabase)
            data.courseData = course ? {
                name: course.name,
                date_display: course.date_display,
                time: course.time,
                date: course.date
            } : null;
            
            data.courseName = course?.name;
            data.courseDate = course?.date_display;
            data.courseTime = course?.time;
            
            this.bookings.push(data);
            console.log('Booking successfully saved to Supabase and added to local array:', data);
            console.log('Current bookings array length:', this.bookings.length);
            
            // Refresh UI
            this.renderCourses();
            this.renderUserBookings();
            if (this.currentUser.role === 'Admin') {
                this.renderAllBookings();
            }
            
            // Booking created successfully - no popup needed for smoother UX
            
        } catch (error) {
            console.error('Error creating booking in Supabase:', error);
            
            // Check if it's a foreign key constraint error
            if (error.code === '23503' || error.message.includes('foreign key constraint')) {
                alert('Course synchronization issue detected. Please refresh the page and try again.');
                // Force refresh courses
                this.courses = await this.generateDailyCourses();
                this.renderCourses();
                return;
            }
            
            // No local storage fallback - fail immediately
            alert(`Failed to create booking: ${error.message}. Please check your internet connection and try again.`);
        }
    }

    // Booking Management
    renderUserBookings() {
        const userBookings = document.getElementById('userBookings');
        const myBookings = this.bookings.filter(b => b.userId === this.currentUser.id);
        
        if (myBookings.length === 0) {
            userBookings.innerHTML = `
                <div class="empty-state">
                    <h4>No Bookings Yet</h4>
                    <p>You haven't made any bookings yet. Visit the Home tab to book a course.</p>
                </div>
            `;
            return;
        }
        
        userBookings.innerHTML = '';
        
        // Sort bookings by timestamp in descending order (latest first)
        const sortedMyBookings = [...myBookings].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        sortedMyBookings.forEach(booking => {
            let course = this.courses.find(c => c.id === booking.courseId);
            
            // If course not found in current courses, try to reconstruct from booking data
            if (!course && booking.courseData) {
                course = booking.courseData;
            } else if (!course) {
                // Create a fallback course object from stored booking information
                course = {
                    name: booking.courseName || 'Unknown Course',
                    date_display: booking.courseDate || 'Unknown Date',
                    time: booking.courseTime || 'Unknown Time'
                };
                console.warn(`Course not found for booking ${booking.id}, using fallback data`);
            }
            
            const bookingItem = document.createElement('div');
            bookingItem.className = 'booking-item';
            
            console.log('Rendering booking:', booking.id, 'Status:', booking.status);
            
            let cancelButton = '';
            if (booking.status === 'Confirmed' || booking.status === 'Pending' || booking.status === 'Waiting List') {
                console.log('Adding cancel button for booking:', booking.id);
                cancelButton = `
                    <div class="booking-actions">
                        <button class="btn-danger" onclick="app.handleCancelBooking(${booking.id})">
                            Cancel Booking
                        </button>
                    </div>
                `;
            } else {
                console.log('No cancel button for booking:', booking.id, 'Status:', booking.status);
            }
            
            // Safe property access with fallbacks
            const courseName = course.name || 'Unknown Course';
            const courseDate = course.date_display || 'Unknown Date';
            const courseTime = course.time || 'Unknown Time';
            
            bookingItem.innerHTML = `
                <div class="booking-info">
                    <h5>${courseName}</h5>
                    <p><strong>Date:</strong> ${courseDate}</p>
                    <p><strong>Time:</strong> ${courseTime}</p>
                    <p><strong>Booked:</strong> ${new Date(booking.timestamp).toLocaleDateString()}</p>
                    ${booking.cancelledAt ? `<p><strong>Cancelled:</strong> ${new Date(booking.cancelledAt).toLocaleDateString()}</p>` : ''}
                </div>
                <div class="booking-status status-${booking.status.toLowerCase().replace(' ', '-')}">
                    ${booking.status}
                </div>
                ${cancelButton}
            `;
            userBookings.appendChild(bookingItem);
        });
    }

    renderAllBookings() {
        const allBookings = document.getElementById('allBookings');
        
        // Enhanced debug logging
        console.log('=== ADMIN PANEL DEBUG ===');
        console.log('Rendering all bookings. Total bookings:', this.bookings.length);
        console.log('Bookings data:', JSON.stringify(this.bookings));
        console.log('Current user:', this.currentUser);
        console.log('Courses data:', this.courses.length, 'courses');
        console.log('Users data:', this.users.length, 'users');
        console.log('Supabase ready:', this.supabaseReady);
        console.log('Booking IDs:', this.bookings.map(b => b.id));
        console.log('Course IDs:', this.courses.map(c => c.id));
        console.log('User IDs:', this.users.map(u => u.id));
        console.log('========================');
        
        // Debug information
        console.log('Rendering all bookings - total count:', this.bookings.length);
        
        if (this.bookings.length === 0) {
            allBookings.innerHTML = `
                <div class="empty-state">
                    <h4>No Bookings</h4>
                    <p>No bookings have been made yet.</p>
                </div>
            `;
            return;
        }
        
        allBookings.innerHTML = '';
        
        // Sort bookings by timestamp in descending order (latest first)
        const sortedBookings = [...this.bookings].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Render all bookings
        sortedBookings.forEach(booking => {
            const course = this.courses.find(c => c.id === booking.courseId);
            const user = this.users.find(u => u.id === booking.userId);
            
            // Log warning if course or user not found, but continue rendering with fallback data
            if (!course || !user) {
                console.warn(`Missing data for booking ${booking.id}: course=${!!course}, user=${!!user}`);
                console.warn('Booking details:', booking);
                if (!course) console.warn('Course not found for courseId:', booking.courseId, 'Available courses:', this.courses.map(c => c.id));
                if (!user) console.warn('User not found for userId:', booking.userId, 'Available users:', this.users.map(u => u.id));
                // Continue rendering with fallback data instead of skipping
            }
            
            const bookingItem = document.createElement('div');
            bookingItem.className = `booking-item ${booking.status === 'Cancelled' ? 'cancelled-booking' : ''}`;

            let actionButtons = '';
            if (booking.status !== 'Cancelled') {
                actionButtons = `
                    <div class="booking-actions">
                        <button class="btn-success" onclick="app.handleUpdateBookingStatus(${booking.id}, 'Confirmed')" 
                                ${booking.status === 'Confirmed' ? 'disabled' : ''}>
                            Confirm
                        </button>
                        <button class="btn-danger" onclick="app.handleUpdateBookingStatus(${booking.id}, 'Rejected')" 
                                ${booking.status === 'Rejected' ? 'disabled' : ''}>
                            Reject
                        </button>
                        <button class="btn-warning" onclick="app.handleUpdateBookingStatus(${booking.id}, 'Waiting List')" 
                                ${booking.status === 'Waiting List' ? 'disabled' : ''}>
                            Waiting List
                        </button>
                    </div>
                `;
            }
            
            // Enhanced course lookup with fallback data
            let courseInfo = course;
            if (!courseInfo && booking.courseData) {
                courseInfo = booking.courseData;
            } else if (!courseInfo) {
                courseInfo = {
                    name: booking.courseName || 'Unknown Course',
                    date_display: booking.courseDate || 'Unknown Date',
                    time: booking.courseTime || 'Unknown Time'
                };
            }
            
            // Enhanced user lookup with fallback data
            let userInfo = user;
            if (!userInfo) {
                userInfo = {
                    firstName: booking.userFirstName || 'Unknown',
                    lastName: booking.userLastName || 'User',
                    first_name: booking.userFirstName || booking.user_first_name || 'Unknown',
                    last_name: booking.userLastName || booking.user_last_name || 'User'
                };
            }
            
            // Safe property access with fallbacks
            const courseName = courseInfo.name || 'Unknown Course';
            const courseDate = courseInfo.date_display || 'Unknown Date';
            const courseTime = courseInfo.time || 'Unknown Time';
            const userFirstName = userInfo.firstName || userInfo.first_name || 'Unknown';
            const userLastName = userInfo.lastName || userInfo.last_name || 'User';
            
            bookingItem.innerHTML = `
                <div class="booking-info">
                    <h5>${courseName} ${booking.status === 'Cancelled' ? '(CANCELLED)' : ''}</h5>
                    <p><strong>Course Date:</strong> ${courseDate}</p>
                    <p><strong>Course Time:</strong> ${courseTime}</p>
                    <p><strong>Member:</strong> ${userFirstName} ${userLastName}</p>
                    <p><strong>Booked:</strong> ${new Date(booking.timestamp).toLocaleDateString()}</p>
                    ${booking.cancelledAt ? `<p><strong>Cancelled:</strong> ${new Date(booking.cancelledAt).toLocaleDateString()} by ${booking.cancelledBy || 'member'}</p>` : ''}
                </div>
                <div class="booking-status status-${booking.status.toLowerCase().replace(' ', '-')}">
                    ${booking.status}
                </div>
                ${actionButtons}
            `;
            allBookings.appendChild(bookingItem);
        });
    }

    renderPendingBookings() {
        const pendingBookingsContainer = document.getElementById('pendingBookings');
        const pendingBookingsList = this.bookings.filter(b => b.status === 'Pending');
        
        if (pendingBookingsList.length === 0) {
            pendingBookingsContainer.innerHTML = '<p class="empty-state">No pending bookings found.</p>';
            return;
        }
        
        pendingBookingsContainer.innerHTML = '';
        
        // Sort by timestamp (latest first)
        const sortedPending = [...pendingBookingsList].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        sortedPending.forEach(booking => {
            const course = this.courses.find(c => c.id === booking.courseId);
            const user = this.users.find(u => u.id === booking.userId);
            
            // Skip rendering if course or user not found
            if (!course || !user) {
                console.warn(`Missing data for pending booking ${booking.id}: course=${!!course}, user=${!!user}`);
                return;
            }
            
            const bookingItem = document.createElement('div');
            bookingItem.className = 'booking-item pending-booking';
            
            // Enhanced course lookup with fallback data
            let courseInfo = course;
            if (!courseInfo && booking.courseData) {
                courseInfo = booking.courseData;
            } else if (!courseInfo) {
                courseInfo = {
                    name: booking.courseName || 'Unknown Course',
                    date_display: booking.courseDate || 'Unknown Date',
                    time: booking.courseTime || 'Unknown Time'
                };
            }
            
            // Safe property access with fallbacks
            const courseName = courseInfo.name || 'Unknown Course';
            const courseDate = courseInfo.date_display || 'Unknown Date';
            const courseTime = courseInfo.time || 'Unknown Time';
            const userFirstName = user.firstName || user.first_name || 'Unknown';
            const userLastName = user.lastName || user.last_name || 'User';
            
            bookingItem.innerHTML = `
                <div class="booking-info">
                    <h5>${courseName}</h5>
                    <p><strong>Course Date:</strong> ${courseDate}</p>
                    <p><strong>Course Time:</strong> ${courseTime}</p>
                    <p><strong>Member:</strong> ${userFirstName} ${userLastName}</p>
                    <p><strong>Booked:</strong> ${new Date(booking.timestamp).toLocaleDateString()}</p>
                </div>
                <div class="booking-status status-pending">
                    Pending
                </div>
                <div class="booking-actions">
                    <button class="btn-success" onclick="app.handleUpdateBookingStatus(${booking.id}, 'Confirmed')">
                        Confirm
                    </button>
                    <button class="btn-danger" onclick="app.handleUpdateBookingStatus(${booking.id}, 'Rejected')">
                        Reject
                    </button>
                    <button class="btn-warning" onclick="app.handleUpdateBookingStatus(${booking.id}, 'Waiting List')">
                        Waiting List
                    </button>
                </div>
            `;             pendingBookingsContainer.appendChild(bookingItem);
        });
    }

    renderCancelledBookings() {
        const cancelledBookingsContainer = document.getElementById('cancelledBookings');
        const cancelledBookingsList = this.bookings.filter(b => b.status === 'Cancelled');
        
        if (cancelledBookingsList.length === 0) {
            cancelledBookingsContainer.innerHTML = '<p class="empty-state">No cancelled bookings found.</p>';
            return;
        }
        
        cancelledBookingsContainer.innerHTML = '';
        
        // Add notification header
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'cancellation-notification';
        notificationDiv.innerHTML = `
            <div class="notification-header">
                <h4>⚠️ Cancelled Bookings (${cancelledBookingsList.length})</h4>
                <p>Members have cancelled the following appointments:</p>
            </div>
        `;
        cancelledBookingsContainer.appendChild(notificationDiv);
        
        // Sort by cancellation date (latest first)
        const sortedCancelled = [...cancelledBookingsList].sort((a, b) => new Date(b.cancelledAt) - new Date(a.cancelledAt));
        
        sortedCancelled.forEach(booking => {
            const course = this.courses.find(c => c.id === booking.courseId);
            const user = this.users.find(u => u.id === booking.userId);
            
            // Skip rendering if course or user not found
            if (!course || !user) {
                console.warn(`Missing data for cancelled booking ${booking.id}: course=${!!course}, user=${!!user}`);
                return;
            }
            
            const bookingItem = document.createElement('div');
            bookingItem.className = 'booking-item cancelled-booking';
            
            // Enhanced course lookup with fallback data
            let courseInfo = course;
            if (!courseInfo && booking.courseData) {
                courseInfo = booking.courseData;
            } else if (!courseInfo) {
                courseInfo = {
                    name: booking.courseName || 'Unknown Course',
                    date_display: booking.courseDate || 'Unknown Date',
                    time: booking.courseTime || 'Unknown Time'
                };
            }
            
            // Safe property access with fallbacks
            const courseName = courseInfo.name || 'Unknown Course';
            const courseDate = courseInfo.date_display || 'Unknown Date';
            const courseTime = courseInfo.time || 'Unknown Time';
            const userFirstName = user.firstName || user.first_name || 'Unknown';
            const userLastName = user.lastName || user.last_name || 'User';
            
            bookingItem.innerHTML = `
                <div class="booking-info">
                    <h5>${courseName} (CANCELLED)</h5>
                    <p><strong>Course Date:</strong> ${courseDate}</p>
                    <p><strong>Course Time:</strong> ${courseTime}</p>
                    <p><strong>Member:</strong> ${userFirstName} ${userLastName}</p>
                    <p><strong>Booked:</strong> ${new Date(booking.timestamp).toLocaleDateString()}</p>
                    <p><strong>Cancelled:</strong> ${new Date(booking.cancelledAt).toLocaleDateString()} by ${booking.cancelledBy || 'member'}</p>
                </div>
                <div class="booking-status status-cancelled">
                    Cancelled
                </div>
            `;             cancelledBookingsContainer.appendChild(bookingItem);
        });
    }

    renderWaitingListBookings() {
        const waitingListContainer = document.getElementById('waitingListBookings');
        const waitingListBookings = this.bookings.filter(b => b.status === 'Waiting List');
        
        if (waitingListBookings.length === 0) {
            waitingListContainer.innerHTML = '<p class="empty-state">No bookings on waiting list.</p>';
            return;
        }
        
        waitingListContainer.innerHTML = '';
        
        // Add notification header
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'waiting-list-notification';
        notificationDiv.innerHTML = `
            <div class="notification-header">
                <h4>📋 Waiting List (${waitingListBookings.length})</h4>
                <p>Members waiting for course availability:</p>
            </div>
        `;
        waitingListContainer.appendChild(notificationDiv);
        
        // Sort by timestamp (latest first)
        const sortedWaitingList = [...waitingListBookings].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        sortedWaitingList.forEach(booking => {
            const course = this.courses.find(c => c.id === booking.courseId);
            const user = this.users.find(u => u.id === booking.userId);
            
            // Skip rendering if user not found
            if (!user) {
                console.warn(`Missing user data for waiting list booking ${booking.id}`);
                return;
            }
            
            // Enhanced course lookup with fallback data
            let courseInfo = course;
            if (!courseInfo && booking.courseData) {
                courseInfo = booking.courseData;
            } else if (!courseInfo) {
                courseInfo = {
                    name: booking.courseName || 'Unknown Course',
                    date_display: booking.courseDate || 'Unknown Date',
                    time: booking.courseTime || 'Unknown Time'
                };
                console.warn(`Course not found for waiting list booking ${booking.id}, using fallback data`);
            }
            
            const bookingItem = document.createElement('div');
            bookingItem.className = 'booking-item waiting-list-booking';
            
            // Safe property access with fallbacks
            const courseName = courseInfo.name || 'Unknown Course';
            const courseDate = courseInfo.date_display || 'Unknown Date';
            const courseTime = courseInfo.time || 'Unknown Time';
            const userFirstName = user.firstName || user.first_name || 'Unknown';
            const userLastName = user.lastName || user.last_name || 'User';
            
            bookingItem.innerHTML = `
                <div class="booking-info">
                    <h5>${courseName} (WAITING LIST)</h5>
                    <p><strong>Course Date:</strong> ${courseDate}</p>
                    <p><strong>Course Time:</strong> ${courseTime}</p>
                    <p><strong>Member:</strong> ${userFirstName} ${userLastName}</p>
                    <p><strong>Added to Waiting List:</strong> ${new Date(booking.timestamp).toLocaleDateString()}</p>
                </div>
                <div class="booking-status status-waiting-list">
                    Waiting List
                </div>
                <div class="booking-actions">
                    <button class="btn-success" onclick="app.handleUpdateBookingStatus(${booking.id}, 'Confirmed')">
                        Confirm
                    </button>
                    <button class="btn-danger" onclick="app.handleUpdateBookingStatus(${booking.id}, 'Rejected')">
                        Reject
                    </button>
                </div>
            `;
            waitingListContainer.appendChild(bookingItem);
        });
    }

    async updateBookingStatus(bookingId, newStatus) {
        console.log('🔄 updateBookingStatus called:', { bookingId, newStatus });
        console.log('📊 Current bookings count before update:', this.bookings.length);
        
        const booking = this.bookings.find(b => b.id === bookingId);
        if (!booking) {
            console.error('❌ Booking not found in local array:', bookingId);
            throw new Error('Booking not found');
        }
        
        console.log('📋 Found booking to update:', booking);
        const oldStatus = booking.status;
        booking.status = newStatus;
        
        if (this.supabaseReady && this.supabaseAdmin) {
            try {
                console.log('🔄 Updating booking in Supabase...');
                const { data, error } = await this.supabaseAdmin
                    .from('bookings')
                    .update({ status: newStatus })
                    .eq('id', bookingId)
                    .select();
                
                if (error) {
                    console.error('❌ Supabase error updating booking status:', error);
                    // Revert local change
                    booking.status = oldStatus;
                    throw new Error(`Failed to update booking status: ${error.message}`);
                }
                console.log('✅ Booking status updated successfully in Supabase:', data);
            } catch (error) {
                console.error('❌ Error updating booking status in Supabase:', error);
                // Revert local change
                booking.status = oldStatus;
                throw error;
            }
        }
        
        console.log('📊 Current bookings count after update:', this.bookings.length);
        console.log('📋 Updated booking in array:', this.bookings.find(b => b.id === bookingId));
        
        // Don't call saveData() here since we already updated Supabase directly
        // The real-time system will handle UI updates automatically
        console.log('🎯 updateBookingStatus completed successfully - waiting for real-time update');
    }

    async cancelBooking(bookingId) {
        console.log('cancelBooking called with ID:', bookingId);
        console.log('Current user:', this.currentUser);
        
        // Check if user is logged in
        if (!this.currentUser) {
            alert('You must be logged in to cancel a booking.');
            return;
        }
        
        // Ensure Supabase is ready - no local fallback
        if (!this.supabaseReady || !this.supabaseAdmin) {
            alert('Database connection not available. Please check your internet connection and try again.');
            return;
        }
        
        if (confirm('Are you sure you want to cancel this booking?')) {
            const booking = this.bookings.find(b => b.id === bookingId);
            console.log('Found booking:', booking);
            
            // Check if booking belongs to current user (unless admin)
            if (booking && this.currentUser.role !== 'Admin' && booking.userId !== this.currentUser.id) {
                alert('You can only cancel your own bookings.');
                return;
            }
            
            if (booking) {
                try {
                    console.log('Cancelling booking in Supabase...');
                    const { data, error } = await this.supabaseAdmin
                        .from('bookings')
                        .update({ 
                            status: 'Cancelled',
                            cancellation_date: new Date().toISOString()
                        })
                        .eq('id', bookingId)
                        .select();
                    
                    if (error) {
                        console.error('Supabase update error:', error);
                        alert(`Failed to cancel booking in database: ${error.message}`);
                        return;
                    }
                    
                    console.log('Supabase update successful:', data);
                    
                    // Update local booking object
                    booking.status = 'Cancelled';
                    booking.cancelledAt = new Date().toISOString();
                    booking.cancelledBy = 'member';
                    
                    // Refresh UI
                    this.renderUserBookings();
                    await this.renderCourses();
                    if (this.currentUser.role === 'Admin') {
                        this.renderAllBookings();
                        this.renderPendingBookings();
                        this.renderWaitingListBookings();
                        this.renderCancelledBookings();
                    }
                    
                    // Booking cancelled successfully - no popup needed for smoother UX
                    console.log('Cancellation process completed');
                    
                } catch (error) {
                    console.error('Error cancelling booking in Supabase:', error);
                    alert(`Failed to cancel booking: ${error.message}. Please check your internet connection and try again.`);
                }
            } else {
                console.error('Booking not found with ID:', bookingId);
                alert('Error: Booking not found.');
            }
        } else {
            console.log('User cancelled the cancellation');
        }
    }

    // User Management
    renderAllUsers() {
        const allUsers = document.getElementById('allUsers');
        allUsers.innerHTML = '';
        
        this.users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            const profilePictureHtml = user.profilePicture || user.profile_picture ? 
                `<img src="${user.profilePicture || user.profile_picture}" alt="Profile" class="profile-picture-small">` : 
                `<div class="profile-picture-placeholder-small">${user.firstName.charAt(0)}${user.lastName.charAt(0)}</div>`;
            
            userItem.innerHTML = `
                <div class="user-info">
                    <div class="user-profile">
                        ${profilePictureHtml}
                        <div class="user-details">
                            <h5>${user.firstName} ${user.lastName}</h5>
                            <p><strong>Email:</strong> ${user.email}</p>
                            <p><strong>Username:</strong> ${user.username}</p>
                            <span class="user-role role-${user.role.toLowerCase()}">${user.role}</span>
                        </div>
                    </div>
                </div>
                <div class="booking-actions">
                    <button class="btn-danger" onclick="app.handleDeleteUser(${user.id})" 
                            ${user.id === this.currentUser.id ? 'disabled' : ''}>
                        ${user.id === this.currentUser.id ? 'Current User' : 'Delete'}
                    </button>
                </div>
            `;
            allUsers.appendChild(userItem);
        });
    }

    async addUser(firstName, lastName, email, password, role, profilePictureFile = null) {
        // Generate username from email (part before @)
        const username = email.split('@')[0];
        
        // Check if username already exists
        if (this.users.find(u => u.username === username)) {
            alert('A user with this email prefix already exists. Please choose a different email.');
            return false;
        }
        
        // Check if email already exists
        if (this.users.find(u => u.email === email)) {
            alert('Email already exists. Please choose a different email.');
            return false;
        }
        
        let profilePictureUrl = null;
        
        // Handle profile picture upload if provided
        if (profilePictureFile && this.storageManager) {
            console.log('Uploading profile picture...');
            
            // Validate file
            const validationErrors = this.storageManager.validateFile(profilePictureFile, 'image');
            if (validationErrors.length > 0) {
                alert(`Profile picture upload failed: ${validationErrors.join(', ')}`);
                return false;
            }
            
            // Show upload progress
            this.showUploadProgress('Uploading profile picture...');
            
            try {
                const uploadResult = await this.storageManager.uploadFile(
                    profilePictureFile, 
                    STORAGE_BUCKETS.PROFILES, 
                    'users',
                    Math.max(...this.users.map(u => u.id), 0) + 1
                );
                
                if (uploadResult.success) {
                    profilePictureUrl = await this.storageManager.getPublicUrl(
                        STORAGE_BUCKETS.PROFILES, 
                        uploadResult.path
                    );
                    console.log('Profile picture uploaded successfully:', profilePictureUrl);
                    this.showUploadStatus('Profile picture uploaded successfully!', 'success');
                } else {
                    console.error('Profile picture upload failed:', uploadResult.error);
                    this.showUploadStatus(`Upload failed: ${uploadResult.error}`, 'error');
                    // Continue without profile picture
                }
            } catch (error) {
                console.error('Profile picture upload error:', error);
                this.showUploadStatus('Upload failed. Continuing without profile picture.', 'error');
                // Continue without profile picture
            }
            
            this.hideUploadProgress();
        }
        
        const newUser = {
            id: Math.max(...this.users.map(u => u.id), 0) + 1,
            first_name: firstName,
            last_name: lastName,
            email: email,
            username: username,
            password: password,
            role: role,
            profile_picture: profilePictureUrl,
            // Keep old format for compatibility
            firstName: firstName,
            lastName: lastName,
            profilePicture: profilePictureUrl
        };
        
        console.log('Adding user. Supabase ready:', this.supabaseReady);
        
        if (this.supabaseReady && this.supabaseAdmin) {
            try {
                // Create clean object with only database column names
                const supabaseUser = {
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    username: username,
                    password: password,
                    role: role,
                    profile_picture: profilePictureUrl
                };
                
                console.log('Attempting to insert user into Supabase:', supabaseUser);
                const { data, error } = await this.supabaseAdmin
                    .from('users')
                    .insert([supabaseUser])
                    .select()
                    .single();
                
                console.log('Supabase insert result:', { data, error });
                
                if (error) throw error;
                
                console.log('User successfully added to Supabase, reloading data...');
                // Reload all users from Supabase to ensure synchronization
                await this.loadFromSupabase();
            } catch (error) {
                console.error('Error adding user to Supabase:', error);
                console.log('Adding user to local storage instead');
                this.users.push(newUser);
            }
        } else {
            console.log('Supabase not ready, adding user to local storage');
            this.users.push(newUser);
        }
        
        await this.saveData();
        this.renderAllUsers();
        return true;
    }

    // Helper methods for upload UI feedback
    showUploadProgress(message) {
        // Create or update progress indicator
        let progressDiv = document.getElementById('upload-progress');
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.id = 'upload-progress';
            progressDiv.className = 'upload-progress';
            document.body.appendChild(progressDiv);
        }
        progressDiv.innerHTML = `
            <div class="upload-progress-content">
                <div class="upload-spinner"></div>
                <span>${message}</span>
            </div>
        `;
        progressDiv.style.display = 'block';
    }

    hideUploadProgress() {
        const progressDiv = document.getElementById('upload-progress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
    }

    showUploadStatus(message, type) {
        // Create or update status message
        let statusDiv = document.getElementById('upload-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'upload-status';
            statusDiv.className = 'upload-status';
            document.body.appendChild(statusDiv);
        }
        statusDiv.className = `upload-status ${type}`;
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (statusDiv) {
                statusDiv.style.display = 'none';
            }
        }, 3000);
    }

    async deleteUser(userId) {
        console.log('deleteUser called with ID:', userId);
        console.log('Current user ID:', this.currentUser.id);
        
        if (userId === this.currentUser.id) {
            alert('You cannot delete your own account.');
            return;
        }
        
        if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            console.log('User confirmed deletion');
            
            if (this.supabaseReady && this.supabaseAdmin) {
                try {
                    console.log('Deleting user bookings from Supabase...');
                    // Delete user's bookings first
                    const { error: bookingsError } = await this.supabaseAdmin
                        .from('bookings')
                        .delete()
                        .eq('user_id', userId);
                    
                    if (bookingsError) {
                        console.error('Error deleting bookings:', bookingsError);
                        throw bookingsError;
                    }
                    console.log('User bookings deleted from Supabase');
                    
                    console.log('Deleting user from Supabase...');
                    // Delete user
                    const { error: userError } = await this.supabaseAdmin
                        .from('users')
                        .delete()
                        .eq('id', userId);
                    
                    if (userError) {
                        console.error('Error deleting user:', userError);
                        throw userError;
                    }
                    console.log('User deleted from Supabase successfully');
                } catch (error) {
                    console.error('Error deleting user from Supabase:', error);
                    alert('Error deleting user from database. Please try again.');
                    return;
                }
            } else {
                console.log('Supabase not ready, deleting from local storage only');
            }
            
            console.log('Removing user from local arrays...');
            const usersBefore = this.users.length;
            const bookingsBefore = this.bookings.length;
            
            this.users = this.users.filter(u => u.id !== userId);
            // Also remove all bookings for this user (check both userId and user_id properties)
            this.bookings = this.bookings.filter(b => b.userId !== userId && b.user_id !== userId);
            
            console.log(`Users: ${usersBefore} -> ${this.users.length}`);
            console.log(`Bookings: ${bookingsBefore} -> ${this.bookings.length}`);
            
            await this.saveData();
            this.renderAllUsers();
            this.renderAllBookings();
            
            alert('User deleted successfully.');
            console.log('User deletion completed');
        } else {
            console.log('User cancelled deletion');
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                if (await this.login(email, password)) {
                    document.getElementById('loginError').textContent = '';
                } else {
                    document.getElementById('loginError').textContent = 'Invalid email or password';
                }
            } catch (error) {
                console.error('Login error:', error);
                document.getElementById('loginError').textContent = 'Login failed. Please try again.';
            }
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                this.showTab(tabName);
            });
        });

        // Admin tab navigation
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-admin-tab');
                this.showAdminTab(tabName);
            });
        });

        // Add user modal
        document.getElementById('addUserBtn').addEventListener('click', () => {
            document.getElementById('addUserModal').classList.add('active');
        });

        // Add user form
        document.getElementById('addUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const firstName = document.getElementById('newFirstName').value;
            const lastName = document.getElementById('newLastName').value;
            const email = document.getElementById('newEmail').value;
            const password = document.getElementById('newPassword').value;
            const role = document.getElementById('newRole').value;
            const profilePictureFile = document.getElementById('newProfilePicture').files[0];
            
            try {
                if (await this.addUser(firstName, lastName, email, password, role, profilePictureFile)) {
                    document.getElementById('addUserModal').classList.remove('active');
                    document.getElementById('addUserForm').reset();
                    alert('User added successfully!');
                }
            } catch (error) {
                console.error('Add user error:', error);
                alert('Failed to add user. Please try again.');
            }
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
            });
        });

        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }
}

// Initialize the application
const app = new BookingApp();

// Global functions for inline event handlers
window.app = app;

// Async wrapper functions for inline handlers
app.handleUpdateBookingStatus = async (bookingId, status) => {
    try {
        await app.updateBookingStatus(bookingId, status);
        // Show success message
        // Booking status updated - no popup needed for smoother UX
    } catch (error) {
        console.error('Error updating booking status:', error);
        // Show specific error message if available
        const errorMessage = error.message || 'Unknown error occurred';
        alert(`Failed to update booking status: ${errorMessage}. Please try again.`);
    }
};

app.handleCancelBooking = async (bookingId) => {
    try {
        await app.cancelBooking(bookingId);
    } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('Failed to cancel booking. Please try again.');
    }
};

app.handleDeleteUser = async (userId) => {
    try {
        await app.deleteUser(userId);
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user. Please try again.');
    }
};

app.handleBookCourse = async (courseId) => {
    try {
        await app.bookCourse(courseId);
    } catch (error) {
        console.error('Error booking course:', error);
        alert('Failed to book course. Please try again.');
    }
};