import NetworkService from './NetworkService.js';

class AuthAPI {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
    }
    
    // Initialize authentication from stored token
    async initialize() {
        const storedToken = NetworkService.getStoredToken();
        if (storedToken) {
            NetworkService.setAuthToken(storedToken);
            
            // Verify token is still valid
            const result = await this.verifyToken();
            if (result.success) {
                this.isAuthenticated = true;
                this.currentUser = result.data.user;
                return true;
            } else {
                // Token invalid, clear it
                NetworkService.setAuthToken(null);
            }
        }
        return false;
    }
    
    // User Registration
    async register(userData) {
        try {
            const result = await NetworkService.post('/api/auth/register', {
                username: userData.username,
                email: userData.email,
                password: userData.password
            });
            
            if (result.success) {
                console.log('✅ User registered successfully');
                // Auto-login after registration
                return await this.login({
                    username: userData.username,
                    password: userData.password
                });
            }
            
            return result;
        } catch (error) {
            console.error('❌ Registration failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // User Login
    async login(credentials) {
        try {
            const result = await NetworkService.post('/api/auth/login', {
                username: credentials.username,
                password: credentials.password
            });
            
            if (result.success) {
                const { token, user } = result.data.data || result.data;
                
                // Store authentication data
                NetworkService.setAuthToken(token);
                this.currentUser = user;
                this.isAuthenticated = true;
                
                console.log('✅ User logged in successfully:', user.username);
                
                // Connect WebSocket after successful login
                try {
                    await NetworkService.connectSocket();
                } catch (socketError) {
                    console.warn('⚠️ WebSocket connection failed:', socketError);
                    // Don't fail login if WebSocket fails
                }
                
                return { success: true, user, token };
            }
            
            return result;
        } catch (error) {
            console.error('❌ Login failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // User Logout
    async logout() {
        try {
            // Call logout endpoint if available
            await NetworkService.post('/api/auth/logout');
        } catch (error) {
            console.warn('⚠️ Logout endpoint failed:', error);
        } finally {
            // Clear local authentication data
            NetworkService.setAuthToken(null);
            NetworkService.disconnectSocket();
            this.currentUser = null;
            this.isAuthenticated = false;
            
            console.log('✅ User logged out');
        }
    }
    
    // Verify Token
    async verifyToken() {
        try {
            const result = await NetworkService.get('/api/auth/verify');
            return result;
        } catch (error) {
            console.error('❌ Token verification failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Get Current User Profile
    async getProfile() {
        try {
            const result = await NetworkService.get('/api/player/profile');
            if (result.success) {
                this.currentUser = { ...this.currentUser, ...result.data.data };
            }
            return result;
        } catch (error) {
            console.error('❌ Failed to get profile:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Update User Profile
    async updateProfile(profileData) {
        try {
            const result = await NetworkService.put('/api/player/profile', profileData);
            if (result.success) {
                this.currentUser = { ...this.currentUser, ...result.data.data };
                console.log('✅ Profile updated successfully');
            }
            return result;
        } catch (error) {
            console.error('❌ Failed to update profile:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Get User Statistics
    async getStats() {
        try {
            const result = await NetworkService.get('/api/player/stats');
            return result;
        } catch (error) {
            console.error('❌ Failed to get stats:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Password Reset (if implemented)
    async requestPasswordReset(email) {
        try {
            const result = await NetworkService.post('/api/auth/forgot-password', { email });
            return result;
        } catch (error) {
            console.error('❌ Password reset request failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Getters
    getCurrentUser() {
        return this.currentUser;
    }
    
    isUserAuthenticated() {
        return this.isAuthenticated && !!NetworkService.authToken;
    }
    
    getUserId() {
        return this.currentUser?.id || null;
    }
    
    getUsername() {
        return this.currentUser?.username || null;
    }
}

export default new AuthAPI(); 