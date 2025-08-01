// Real-time Integration for Saitama Physio Fit Booking System
// Updated code for your specific application

// Supabase client is expected to be initialized in script.js
// and available globally as `supabase`

// Real-time Booking System Extension
class RealtimeBookingSystem {
    constructor(bookingApp) {
        this.app = bookingApp;
        this.channels = [];
        this.isConnected = false;
        this.init();
    }

    async init() {
        console.log('🔄 Initializing real-time features...');
        await this.setupRealtimeSubscriptions();
        this.addRealtimeUI();
    }

    async setupRealtimeSubscriptions() {
        try {
            // Get the global supabase client
            const supabaseClient = window.supabaseClient || window.supabase || supabase;
            if (!supabaseClient) {
                throw new Error('Supabase client not available. Make sure it is initialized in script.js');
            }
            
            // Detect Supabase version by checking for the 'channel' method
            const isV2 = supabaseClient && typeof supabaseClient.channel === 'function';
            console.log(`Using Supabase ${isV2 ? 'v2.x' : 'v1.x'} API for real-time subscriptions`);

            // Subscribe to bookings table changes
            if (isV2) {
                // Supabase v2.x API - use channel()
                const bookingsChannel = supabaseClient
                    .channel('bookings-changes')
                    .on(
                        'postgres_changes',
                        {
                            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                            schema: 'public',
                            table: 'bookings'
                        },
                        (payload) => {
                            console.log('📝 Booking real-time update:', payload);
                            this.handleBookingChange(payload);
                        }
                    )
                    .subscribe((status) => {
                        console.log('📡 Bookings subscription status:', status);
                        this.updateConnectionStatus('bookings', status);
                    });
                    
                this.channels.push(bookingsChannel);
            }

            // Subscribe to users table changes
            if (isV2) {
                // Supabase v2.x API - use channel()
                const usersChannel = supabaseClient
                    .channel('users-changes')
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'users'
                        },
                        (payload) => {
                            console.log('👤 User real-time update:', payload);
                            this.handleUserChange(payload);
                        }
                    )
                    .subscribe((status) => {
                        console.log('📡 Users subscription status:', status);
                        this.updateConnectionStatus('users', status);
                    });
                    
                this.channels.push(usersChannel);
            }

            // Subscribe to courses table changes
            if (isV2) {
                // Supabase v2.x API - use channel()
                const coursesChannel = supabaseClient
                    .channel('courses-changes')
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'courses'
                        },
                        (payload) => {
                            console.log('📚 Course real-time update:', payload);
                            this.handleCourseChange(payload);
                        }
                    )
                    .subscribe((status) => {
                        console.log('📡 Courses subscription status:', status);
                        this.updateConnectionStatus('courses', status);
                    });
                    
                this.channels.push(coursesChannel);
            }

            console.log('✅ Real-time subscriptions set up successfully');
        } catch (error) {
            console.error('❌ Failed to setup real-time subscriptions:', error);
        }
    }

    handleBookingChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        console.log('🔄 REALTIME BOOKING CHANGE:', { eventType, newRecord, oldRecord });
        console.log('📊 Current bookings count before realtime update:', this.app?.bookings?.length || 0);
        
        switch (eventType) {
            case 'INSERT':
                console.log('➕ New booking created:', newRecord);
                this.showNotification('New booking created!', 'success');
                // Add to local bookings array
                if (this.app && this.app.bookings) {
                    this.app.bookings.push({
                        id: newRecord.id,
                        userId: newRecord.user_id,
                        courseId: newRecord.course_id,
                        status: newRecord.status,
                        timestamp: newRecord.timestamp,
                        // Keep compatibility with existing format
                        user_id: newRecord.user_id,
                        course_id: newRecord.course_id
                    });
                    console.log('📊 Bookings count after INSERT:', this.app.bookings.length);
                }
                break;
                
            case 'UPDATE':
                console.log('✏️ Booking updated:', { old: oldRecord, new: newRecord });
                this.showNotification(`Booking status updated to ${newRecord.status}`, 'info');
                // Update local booking
                if (this.app && this.app.bookings) {
                    const bookingIndex = this.app.bookings.findIndex(b => b.id === newRecord.id);
                    console.log('🔍 Found booking at index:', bookingIndex);
                    if (bookingIndex !== -1) {
                        console.log('📝 Updating booking:', this.app.bookings[bookingIndex]);
                        this.app.bookings[bookingIndex] = {
                            ...this.app.bookings[bookingIndex],
                            status: newRecord.status,
                            timestamp: newRecord.timestamp,
                            cancellation_date: newRecord.cancellation_date
                        };
                        
                        // Only add cancelled_by if it exists in the record
                        if (newRecord.cancelled_by !== undefined) {
                            this.app.bookings[bookingIndex].cancelled_by = newRecord.cancelled_by;
                        }
                        console.log('✅ Updated booking:', this.app.bookings[bookingIndex]);
                    } else {
                        console.warn('⚠️ Booking not found in local array for update!');
                    }
                    console.log('📊 Bookings count after UPDATE:', this.app.bookings.length);
                }
                break;
                
            case 'DELETE':
                console.log('🗑️ Booking deleted:', oldRecord);
                this.showNotification('Booking deleted!', 'warning');
                // Remove from local bookings array
                if (this.app && this.app.bookings) {
                    const beforeCount = this.app.bookings.length;
                    this.app.bookings = this.app.bookings.filter(b => b.id !== oldRecord.id);
                    console.log(`📊 Bookings count: ${beforeCount} → ${this.app.bookings.length}`);
                }
                break;
        }

        console.log('🎯 Refreshing UI after realtime change...');
        // Refresh UI
        this.refreshBookingUI();
    }

    handleUserChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        switch (eventType) {
            case 'INSERT':
                console.log('➕ New user registered:', newRecord);
                this.showNotification('New user registered!', 'success');
                if (this.app && this.app.users) {
                    this.app.users.push({
                        id: newRecord.id,
                        firstName: newRecord.first_name,
                        lastName: newRecord.last_name,
                        email: newRecord.email,
                        username: newRecord.username,
                        password: newRecord.password,
                        role: newRecord.role
                    });
                }
                break;
                
            case 'UPDATE':
                console.log('✏️ User updated:', newRecord);
                this.showNotification('User information updated!', 'info');
                if (this.app && this.app.users) {
                    const userIndex = this.app.users.findIndex(u => u.id === newRecord.id);
                    if (userIndex !== -1) {
                        this.app.users[userIndex] = {
                            ...this.app.users[userIndex],
                            firstName: newRecord.first_name,
                            lastName: newRecord.last_name,
                            email: newRecord.email,
                            username: newRecord.username,
                            role: newRecord.role
                        };
                    }
                }
                break;
                
            case 'DELETE':
                console.log('🗑️ User deleted:', oldRecord);
                this.showNotification('User deleted!', 'warning');
                if (this.app && this.app.users) {
                    this.app.users = this.app.users.filter(u => u.id !== oldRecord.id);
                }
                break;
        }

        // Refresh user management UI if admin is viewing
        if (this.app && this.app.currentUser && this.app.currentUser.role === 'admin') {
            this.app.renderAllUsers();
        }
    }

    async handleCourseChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        switch (eventType) {
            case 'INSERT':
                console.log('➕ New course added:', newRecord);
                this.showNotification('New course available!', 'success');
                if (this.app && this.app.courses) {
                    this.app.courses.push({
                        id: newRecord.id,
                        name: newRecord.name,
                        time: newRecord.time,
                        date: newRecord.date,
                        date_display: newRecord.date_display,
                        day_of_week: newRecord.day_of_week
                    });
                }
                break;
                
            case 'UPDATE':
                console.log('✏️ Course updated:', newRecord);
                this.showNotification('Course information updated!', 'info');
                if (this.app && this.app.courses) {
                    const courseIndex = this.app.courses.findIndex(c => c.id === newRecord.id);
                    if (courseIndex !== -1) {
                        this.app.courses[courseIndex] = {
                            ...this.app.courses[courseIndex],
                            name: newRecord.name,
                            time: newRecord.time,
                            date: newRecord.date,
                            date_display: newRecord.date_display,
                            day_of_week: newRecord.day_of_week
                        };
                    }
                }
                break;
                
            case 'DELETE':
                console.log('🗑️ Course deleted:', oldRecord);
                this.showNotification('Course cancelled!', 'warning');
                if (this.app && this.app.courses) {
                    this.app.courses = this.app.courses.filter(c => c.id !== oldRecord.id);
                }
                break;
        }

        // Refresh courses UI
        if (this.app && this.app.renderCourses) {
            await this.app.renderCourses();
        }
    }

    refreshBookingUI() {
        if (this.app) {
            // Refresh all booking-related UI components
            if (this.app.renderUserBookings) this.app.renderUserBookings();
            if (this.app.renderAllBookings) this.app.renderAllBookings();
            if (this.app.renderPendingBookings) this.app.renderPendingBookings();
            if (this.app.renderWaitingListBookings) this.app.renderWaitingListBookings();
            if (this.app.renderCancelledBookings) this.app.renderCancelledBookings();
        }
    }

    updateConnectionStatus(table, status) {
        const statusElement = document.getElementById('realtime-status');
        if (statusElement) {
            const isConnected = status === 'SUBSCRIBED';
            this.isConnected = isConnected;
            
            statusElement.innerHTML = `
                <span class="status-indicator ${isConnected ? 'connected' : 'disconnected'}"></span>
                Real-time: ${isConnected ? 'Connected' : 'Disconnected'}
            `;
            
            if (isConnected) {
                this.showNotification(`Real-time ${table} updates enabled!`, 'success');
            }
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `realtime-notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${this.getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            default: return 'ℹ️';
        }
    }

    addRealtimeUI() {
        // Real-time status indicator removed per user request
        // const statusDiv = document.createElement('div');
        // statusDiv.id = 'realtime-status';
        // statusDiv.className = 'realtime-status';
        // statusDiv.innerHTML = `
        //     <span class="status-indicator disconnected"></span>
        //     Real-time: Connecting...
        // `;
        // document.body.appendChild(statusDiv);

        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            .realtime-status {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .status-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
            }
            
            .status-indicator.connected {
                background: #4CAF50;
                box-shadow: 0 0 6px #4CAF50;
            }
            
            .status-indicator.disconnected {
                background: #F44336;
            }
            
            .realtime-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10001;
                display: flex;
                align-items: center;
                gap: 8px;
                max-width: 300px;
                animation: slideInRight 0.3s ease-out;
                margin-bottom: 8px;
            }
            
            .notification-success {
                border-left: 4px solid #4CAF50;
            }
            
            .notification-warning {
                border-left: 4px solid #FF9800;
            }
            
            .notification-error {
                border-left: 4px solid #F44336;
            }
            
            .notification-info {
                border-left: 4px solid #2196F3;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
                color: #666;
                margin-left: auto;
            }
            
            .notification-close:hover {
                color: #000;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Cleanup method
    cleanup() {
        console.log('🔌 Cleaning up real-time subscriptions...');
        this.channels.forEach(channel => {
            if (channel) {
                channel.unsubscribe();
            }
        });
        this.channels = [];
        
        // Remove UI elements
        const statusElement = document.getElementById('realtime-status');
        if (statusElement) {
            statusElement.remove();
        }
    }
}

// Auto-initialize when the main app is ready
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        // Wait for the main BookingApp to be initialized
        setTimeout(() => {
            if (window.app && window.app instanceof BookingApp) {
                console.log('🚀 Initializing real-time features for Saitama Physio Fit...');
                window.realtimeSystem = new RealtimeBookingSystem(window.app);
            } else {
                console.log('⚠️ Main BookingApp not found, real-time features not initialized');
            }
        }, 2000);
    });
}

// Export for manual initialization
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealtimeBookingSystem;
}