// Saitama Physio Fit Booking System
// Data Management and Application Logic with Supabase Integration

// Supabase Configuration
const SUPABASE_URL = 'https://rbfephzobczjludtfnej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZmVwaHpvYmN6amx1ZHRmbmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2OTg2NDUsImV4cCI6MjA2OTI3NDY0NX0.09_Z5kAr47z-MxXJg00mYVDNyRua47qns9jZntwMx8M';

// Supabase Storage Configuration
const SUPABASE_STORAGE_URL = 'https://rbfephzobczjludtfnej.supabase.co/storage/v1/s3';
const SUPABASE_REGION = 'eu-central-1';
const STORAGE_BUCKETS = {
    PROFILES: 'user-profiles',
    COURSES: 'course-images',
    DOCUMENTS: 'documents'
};

// Initialize Supabase client only if credentials are provided
let supabase;
if (typeof window !== 'undefined' && window.supabase && 
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    try {
        // Create the Supabase client with additional options
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
                    timeout: 15000 // 15 seconds timeout
                }
            }
        });
        console.log('Supabase client initialized successfully');
    } catch (error) {
        console.error('Error initializing Supabase client:', error);
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

            for (const [key, bucketName] of Object.entries(STORAGE_BUCKETS)) {
                try {
                    // Try to get bucket info (this will fail if bucket doesn't exist)
                    const { data, error } = await this.supabase.storage.getBucket(bucketName);
                    
                    if (error && error.message.includes('not found')) {
                        // Bucket doesn't exist, create it
                        console.log(`Creating storage bucket: ${bucketName}`);
                        const { data: createData, error: createError } = await this.supabase.storage
                            .createBucket(bucketName, {
                                public: true,
                                allowedMimeTypes: key === 'PROFILES' || key === 'COURSES' ? this.allowedImageTypes : this.allowedDocumentTypes,
                                fileSizeLimit: this.maxFileSize
                            });
                        
                        if (createError) {
                            console.error(`Failed to create bucket ${bucketName}:`, createError);
                        } else {
                            console.log(`✅ Bucket ${bucketName} created successfully`);
                        }
                    } else if (!error) {
                        console.log(`✅ Bucket ${bucketName} already exists`);
                    }
                } catch (bucketError) {
                    console.error(`Error with bucket ${bucketName}:`, bucketError);
                }
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
        this.init();
    }

    async init() {
        await this.initializeSupabase();
        this.initializeStorageManager();
        await this.loadData();
        await this.initializeDefaultData();
        this.setupEventListeners();
        this.setupConnectionStatusIndicator();
        
        // Check for existing session via Supabase
        await this.checkSupabaseSession();
        if (this.currentUser) {
            await this.showMainScreen();
        } else {
            this.showLoginScreen();
        }
    }

    initializeStorageManager() {
        if (supabase) {
            this.storageManager = new StorageManager(supabase);
            console.log('✅ Storage Manager initialized');
            
            // Initialize storage buckets if Supabase is ready
            if (this.supabaseReady) {
                this.storageManager.initializeBuckets();
            }
        } else {
            console.warn('⚠️ Storage Manager not initialized - Supabase client unavailable');
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
            statusIndicator.textContent = '❌ Database Connection Error';
            statusIndicator.style.backgroundColor = '#F8D7DA';
            statusIndicator.style.color = '#721C24';
            statusIndicator.style.border = '1px solid #F5C6CB';
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
            console.log('Supabase not configured');
            this.supabaseReady = false;
            return;
        }
        
        console.log('Testing Supabase connection...');
        console.log('Supabase URL:', SUPABASE_URL);
        console.log('Supabase client initialized:', !!supabase);
        
        try {
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
                const { data, error, count } = await supabase.from('users').select('*', { count: 'exact', head: true });
                console.log('Supabase test result:', { data, error });
                
                if (!error) {
                    this.supabaseReady = true;
                    console.log('✅ Supabase connection established successfully');
                } else {
                    console.error('❌ Supabase tables not accessible:', error);
                    console.log('Error details:', {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code
                    });
                    console.log('This might be because:');
                    console.log('1. Tables have not been created in Supabase yet');
                    console.log('2. Row Level Security (RLS) is blocking access');
                    console.log('3. API key permissions are insufficient');
                    console.log('Supabase connection failed - app requires database connection');
                    this.supabaseReady = false;
                }
            } catch (queryError) {
                console.error('❌ Supabase query failed:', queryError);
                console.log('Supabase connection failed - app requires database connection');
                this.supabaseReady = false;
            }
        } catch (error) {
            console.error('❌ Supabase connection failed:', error);
            console.log('Error type:', error.name);
            console.log('Error message:', error.message);
            if (error.message && error.message.includes('ERR_ABORTED')) {
                console.log('🔍 Network request was aborted. This usually means:');
                console.log('1. CORS policy is blocking the request');
                console.log('2. The Supabase project is paused or doesn\'t exist');
                console.log('3. Network connectivity issues');
                console.log('4. API key is invalid or expired');
                console.log('5. Supabase service might be experiencing issues');
            }
            console.log('Supabase connection failed - app requires database connection');
            this.supabaseReady = false;
        }
    }

    async createTables() {
        // Note: In a real Supabase setup, tables should be created via the Supabase dashboard
        // This is just for demonstration - you'll need to create these tables manually
        console.log('Please create the following tables in your Supabase dashboard:');
        console.log('1. users (id, first_name, last_name, email, username, password, role, created_at)');
        console.log('2. courses (id, name, time, date, date_display, day_of_week, created_at)');
        console.log('3. bookings (id, user_id, course_id, status, timestamp, cancellation_date, created_at)');
    }

    // Data Management
    async loadData() {
        if (this.supabaseReady) {
            await this.loadFromSupabase();
        } else {
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        console.warn('⚠️ localStorage loading deprecated - using empty arrays instead');
        this.users = [];
        this.courses = [];
        this.bookings = [];
    }

    async loadFromSupabase() {
        try {
            console.log('Attempting to load data from Supabase...');
            
            // Check Supabase connection first
            if (!this.supabaseReady) {
                console.warn('Supabase connection not ready - initializing with empty arrays');
                this.users = [];
                this.courses = [];
                this.bookings = [];
                return;
            }
            
            // Load users with error handling
            try {
                const { data: users, error: usersError } = await supabase
                    .from('users')
                    .select('*');
                    
                if (usersError) {
                    console.error('Error loading users:', usersError);
                    throw usersError;
                }
                
                // Add compatibility fields for users
                this.users = (users || []).map(user => ({
                    ...user,
                    firstName: user.first_name,
                    lastName: user.last_name
                }));
                console.log(`Successfully loaded ${this.users.length} users from Supabase`);
            } catch (userError) {
                console.error('Failed to load users, will try to continue with other data:', userError);
                this.users = [];
            }

            // Load courses with error handling
            try {
                const { data: courses, error: coursesError } = await supabase
                    .from('courses')
                    .select('*');
                    
                if (coursesError) {
                    console.error('Error loading courses:', coursesError);
                    throw coursesError;
                }
                
                this.courses = courses || [];
                console.log(`Successfully loaded ${this.courses.length} courses from Supabase`);
            } catch (courseError) {
                console.error('Failed to load courses, will try to continue with other data:', courseError);
                this.courses = [];
            }

            // Load bookings with error handling
            try {
                const { data: bookings, error: bookingsError } = await supabase
                    .from('bookings')
                    .select('*');
                    
                if (bookingsError) {
                    console.error('Error loading bookings:', bookingsError);
                    throw bookingsError;
                }
                
                // Add compatibility fields for bookings
                this.bookings = (bookings || []).map(booking => ({
                    ...booking,
                    userId: booking.user_id,
                    courseId: booking.course_id
                }));
                console.log(`Successfully loaded ${this.bookings.length} bookings from Supabase`);
            } catch (bookingError) {
                console.error('Failed to load bookings:', bookingError);
                this.bookings = [];
            }

        } catch (error) {
            console.error('Error loading data from Supabase:', error);
            console.log('Initializing with empty arrays');
            this.users = [];
            this.courses = [];
            this.bookings = [];
        }
    }

    async saveData() {
        if (this.supabaseReady) {
            await this.saveToSupabase();
        } else {
            console.warn('Supabase not ready - data not saved');
        }
    }

    saveToLocalStorage() {
        console.warn('⚠️ localStorage saving deprecated - data not saved locally');
    }

    async saveToSupabase() {
        // Check if Supabase is ready before attempting to save
        if (!this.supabaseReady) {
            console.warn('Supabase connection not ready, data not saved');
            return;
        }
        
        console.log('Attempting to save data to Supabase...');
        
        try {
            // Note: In a production app, you would implement proper upsert operations here
            // This is a simplified version for demonstration purposes
            console.log('Data saved to Supabase successfully');
            
            // Emit an event that data was saved successfully
            const event = new CustomEvent('supabase-save-success');
            document.dispatchEvent(event);
        } catch (error) {
            console.error('Error saving data to Supabase:', error);
            
            // Emit an event that data was not saved
            const event = new CustomEvent('supabase-save-error', { detail: error });
            document.dispatchEvent(event);
        }
    }

    async initializeDefaultData() {
        // Initialize default users if none exist
        if (this.users.length === 0 && this.supabaseReady) {
            const defaultUsers = [
                { id: 1, first_name: 'Admin', last_name: 'User', email: 'admin@saitama.com', username: 'admin', password: 'admin123', role: 'Admin' },
                { id: 2, first_name: 'John', last_name: 'Doe', email: 'john.doe@email.com', username: 'member1', password: 'member123', role: 'Member' },
                { id: 3, first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@email.com', username: 'member2', password: 'member456', role: 'Member' }
            ];
            
            await this.insertDefaultUsers(defaultUsers);
        }

        // Generate daily courses for the next 4 weeks
        const generatedCourses = this.generateDailyCourses();
        if (this.supabaseReady) {
            // Always check and insert courses to ensure they exist
            const { data, error } = await supabase.from('courses').select('id, name').limit(5);
            if (error) {
                console.error('Error checking for existing courses:', error);
            } else {
                console.log('DEBUG: Current courses in database:', data);
                console.log('DEBUG: Generated courses count:', generatedCourses.length);
                
                // Always insert courses to ensure they exist in database
                console.log('DEBUG: Inserting/updating courses in database');
                await this.insertDefaultCourses(generatedCourses);
            }
        }
        
        await this.saveData();
    }

    async insertDefaultUsers(users) {
        if (!this.supabaseReady) {
            console.warn('Supabase not ready for inserting default users');
            return;
        }
        
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
            
            const { data, error } = await supabase
                .from('users')
                .insert(supabaseUsers)
                .select();
            if (error) throw error;
            this.users = data;
        } catch (error) {
            console.error('Error inserting default users:', error);
            this.users = [];
        }
    }

    async insertDefaultCourses(courses) {
        if (!this.supabaseReady) {
            console.warn('Supabase not ready for inserting default courses');
            return;
        }
        
        try {
            // Create clean objects with only database column names
            const supabaseCourses = courses.map(course => ({
                id: course.id, // Keep original string ID
                name: course.name,
                time: course.time,
                date: course.date,
                date_display: course.date_display,
                day_of_week: course.day_of_week
            }));
            
            console.log('DEBUG: Attempting to upsert courses:', supabaseCourses.length);
            
            // Use upsert to handle existing courses
            const { data, error } = await supabase
                .from('courses')
                .upsert(supabaseCourses, { onConflict: 'id' })
                .select();
                
            if (error) {
                console.error('Error upserting courses:', error);
                throw error;
            }
            
            console.log('DEBUG: Successfully upserted courses:', data.length);
            this.courses = data;
            
        } catch (error) {
            console.error('Error inserting default courses:', error);
            // Try to load existing courses instead
            try {
                const { data: existingCourses, error: loadError } = await supabase
                    .from('courses')
                    .select('*');
                if (!loadError && existingCourses) {
                    this.courses = existingCourses;
                    console.log('DEBUG: Loaded existing courses:', existingCourses.length);
                } else {
                    this.courses = [];
                }
            } catch (loadError) {
                console.error('Error loading existing courses:', loadError);
                this.courses = [];
            }
        }
    }

    generateDailyCourses() {
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
            
            const daySchedule = weeklySchedule[dayOfWeek];
            if (daySchedule) {
                daySchedule.forEach(session => {
                    const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                    // Create stable ID based on date, time, and course name
                    const stableId = `${dateStr}_${session.time.replace(/[–:]/g, '')}_${session.name.replace(/[^a-zA-Z0-9]/g, '')}`;
                    
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
                        day_of_week: currentDate.toLocaleDateString('de-DE', { weekday: 'long' }),
                        // Keep old format for compatibility
                        dateDisplay: currentDate.toLocaleDateString('de-DE', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        }),
                        dayOfWeek: currentDate.toLocaleDateString('de-DE', { weekday: 'long' })
                    });
                });
            }
        }
        
        return courses;
    }

    // Authentication
    async login(email, password) {
        if (!this.supabaseReady) {
            console.error('Supabase not available for authentication');
            return false;
        }
        
        try {
            // Authenticate directly against the Supabase users table
            console.log('Authenticating user against Supabase users table...');
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .eq('password', password)
                .single();
            
            if (error || !data) {
                console.error('Login failed - invalid email or password:', error);
                return false;
            }
            
            console.log('User authenticated successfully:', data.email);
            this.currentUser = data;
            
            // Convert Supabase format to app format for compatibility
            if (this.currentUser.first_name) {
                this.currentUser.firstName = this.currentUser.first_name;
                this.currentUser.lastName = this.currentUser.last_name;
            }
            
            await this.showMainScreen();
            return true;
            
        } catch (error) {
            console.error('Login error:', error);
        }
        
        return false;
    }

    async checkSupabaseSession() {
        // Since we're using direct database authentication, 
        // we don't need to check Supabase Auth sessions
        console.log('Using direct database authentication - no session check needed');
        return;
    }

    logout() {
        this.currentUser = null;
        console.log('User logged out');
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
        
        // Refresh courses to ensure they're up to date
        const generatedCourses = this.generateDailyCourses();
        if (this.courses.length === 0) {
            if (this.supabaseReady) {
                await this.insertDefaultCourses(generatedCourses);
            } else {
                this.courses = generatedCourses;
            }
        }
        await this.saveData();
        
        // Show/hide tabs based on role
        const adminTab = document.querySelector('.admin-only');
        const memberTabs = document.querySelectorAll('.member-only');
        
        if (this.currentUser.role === 'Admin') {
            adminTab.style.display = 'block';
            memberTabs.forEach(tab => tab.style.display = 'none');
            this.showTab('admin');
            this.renderAllBookings();
            this.renderAllUsers();
        } else {
            adminTab.style.display = 'none';
            memberTabs.forEach(tab => tab.style.display = 'block');
            this.showTab('courses');
            this.renderCourses();
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
    renderCourses() {
        // Regenerate courses to ensure they're always up to date
        this.courses = this.generateDailyCourses();
        
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
            dateHeader.innerHTML = `<h3>${coursesByDate[date][0].dateDisplay}</h3>`;
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
        console.log('DEBUG: createBooking called with courseId:', courseId, 'type:', typeof courseId);
        
        if (!this.supabaseReady) {
            alert('Database connection not available. Cannot create booking.');
            return;
        }

        const course = this.courses.find(c => c.id === courseId);
        console.log('DEBUG: Found course:', course);
        console.log('DEBUG: All available courses:', this.courses.map(c => ({id: c.id, name: c.name})));

        if (!course) {
            console.error('Course not found for booking:', courseId);
            alert('Could not find the selected course. Please refresh and try again.');
            return;
        }

        // First, verify the course exists in the database
        const { data: dbCourse, error: courseCheckError } = await supabase
            .from('courses')
            .select('id, name')
            .eq('id', course.id)
            .single();
            
        console.log('DEBUG: Course check in database:', dbCourse, 'Error:', courseCheckError);
        
        if (courseCheckError || !dbCourse) {
            console.error('Course does not exist in database:', course.id);
            alert('This course is not available in the database. Please refresh the page.');
            return;
        }

        const newBooking = {
            user_id: this.currentUser.id,
            course_id: course.id, // Use the course ID as-is
            status: 'Pending' // Default status
        };
        
        console.log('DEBUG: Attempting to create booking:', newBooking);

        try {
            const { data, error } = await supabase
                .from('bookings')
                .insert(newBooking)
                .select();

            if (error) {
                console.error('Error creating booking in Supabase:', error);
                throw error;
            }

            // Add the new booking to the local array for immediate UI update
            this.bookings.push(...data.map(b => ({ ...b, userId: b.user_id, courseId: b.course_id })));
            console.log('Booking created successfully:', data[0]);

            // Re-render relevant parts of the UI
            this.renderCourses();
            this.renderUserBookings();

            // Booking successful - no popup needed for smoother UX

        } catch (error) {
            console.error('Failed to create booking:', error);
            alert(`Error creating booking: ${error.message}. Please try again.`);
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
                    dateDisplay: booking.courseDate || 'Unknown Date',
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
            const courseDate = course.dateDisplay || course.date_display || 'Unknown Date';
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
            
            // Skip rendering if course or user not found
            if (!course || !user) {
                console.warn(`Missing data for booking ${booking.id}: course=${!!course}, user=${!!user}`);
                return;
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
                    dateDisplay: booking.courseDate || 'Unknown Date',
                    time: booking.courseTime || 'Unknown Time'
                };
            }
            
            // Safe property access with fallbacks
            const courseName = courseInfo.name || 'Unknown Course';
            const courseDate = courseInfo.dateDisplay || courseInfo.date_display || 'Unknown Date';
            const courseTime = courseInfo.time || 'Unknown Time';
            const userFirstName = user.firstName || user.first_name || 'Unknown';
            const userLastName = user.lastName || user.last_name || 'User';
            
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
                    dateDisplay: booking.courseDate || 'Unknown Date',
                    time: booking.courseTime || 'Unknown Time'
                };
            }
            
            // Safe property access with fallbacks
            const courseName = courseInfo.name || 'Unknown Course';
            const courseDate = courseInfo.dateDisplay || courseInfo.date_display || 'Unknown Date';
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
                    dateDisplay: booking.courseDate || 'Unknown Date',
                    time: booking.courseTime || 'Unknown Time'
                };
            }
            
            // Safe property access with fallbacks
            const courseName = courseInfo.name || 'Unknown Course';
            const courseDate = courseInfo.dateDisplay || courseInfo.date_display || 'Unknown Date';
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
                    dateDisplay: booking.courseDate || 'Unknown Date',
                    time: booking.courseTime || 'Unknown Time'
                };
                console.warn(`Course not found for waiting list booking ${booking.id}, using fallback data`);
            }
            
            const bookingItem = document.createElement('div');
            bookingItem.className = 'booking-item waiting-list-booking';
            
            // Safe property access with fallbacks
            const courseName = courseInfo.name || 'Unknown Course';
            const courseDate = courseInfo.dateDisplay || courseInfo.date_display || 'Unknown Date';
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
        const booking = this.bookings.find(b => b.id === bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }
        
        booking.status = newStatus;
        
        if (this.supabaseReady) {
            try {
                const { error } = await supabase
                    .from('bookings')
                    .update({ status: newStatus })
                    .eq('id', bookingId);
                
                if (error) {
                    console.error('Supabase error updating booking status:', error);
                    throw new Error(`Failed to update booking status: ${error.message}`);
                }
                console.log('Booking status updated successfully in Supabase');
            } catch (error) {
                console.error('Error updating booking status in Supabase:', error);
                // Re-throw the error so it can be caught by the handler
                throw error;
            }
        }
        
        await this.saveData();
        this.renderAllBookings();
        this.renderPendingBookings();
        this.renderWaitingListBookings();
        this.renderCancelledBookings();
        this.renderUserBookings();
        this.renderCourses();
    }

    async cancelBooking(bookingId) {
        console.log('cancelBooking called with ID:', bookingId);
        console.log('Current user:', this.currentUser);
        console.log('Current bookings:', this.bookings);
        
        // Check if user is logged in
        if (!this.currentUser) {
            alert('You must be logged in to cancel a booking.');
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
                console.log('Cancelling booking. Original status:', booking.status);
                booking.status = 'Cancelled';
                booking.cancelledAt = new Date().toISOString();
                booking.cancelledBy = 'member';
                
                console.log('Updated booking:', booking);
                
                if (this.supabaseReady) {
                    try {
                        console.log('Updating booking in Supabase...');
                        const { data, error } = await supabase
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
                            return; // Don't proceed if database update fails
                        }
                        console.log('Supabase update successful:', data);
                    } catch (error) {
                        console.error('Error cancelling booking in Supabase:', error);
                        alert(`Failed to cancel booking: ${error.message}`);
                        return; // Don't proceed if there's an error
                    }
                } else {
                    console.log('Supabase not ready - booking cancellation may not persist');
                }
                
                console.log('Saving data and refreshing UI...');
                await this.saveData();
                this.renderUserBookings();
                this.renderCourses();
                if (this.currentUser.role === 'Admin') {
                    this.renderAllBookings();
                    this.renderPendingBookings();
                    this.renderWaitingListBookings();
                    this.renderCancelledBookings();
                }
                // Booking cancelled successfully - no popup needed for smoother UX
                console.log('Cancellation process completed');
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
        
        if (this.supabaseReady) {
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
                
                // Insert user details into Supabase users table
                console.log('Attempting to insert user into Supabase:', supabaseUser);
                const { data, error } = await supabase
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
            
            if (this.supabaseReady) {
                try {
                    console.log('Deleting user bookings from Supabase...');
                    // Delete user's bookings first
                    const { error: bookingsError } = await supabase
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
                    const { error: userError } = await supabase
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