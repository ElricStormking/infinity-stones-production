// SessionService - Portal-first authentication session management
// Implements casino-grade security with portal-first architecture

window.SessionService = new (class SessionService {
    constructor() {
        this.sessionToken = null;
        this.refreshToken = null;
        this.sessionExpiry = null;
        this.refreshExpiry = null;
        this.isValidating = false;
        this.refreshTimer = null;
        this.portalUrl = this.getPortalUrl();
        
        // Session validation intervals
        this.VALIDATION_INTERVAL = 5 * 60 * 1000; // 5 minutes
        this.REFRESH_BUFFER = 10 * 60 * 1000; // Refresh 10 minutes before expiry
        this.MAX_VALIDATION_RETRIES = 3;
        
        console.log('🔐 SessionService initialized with portal:', this.portalUrl);
    }
    
    getPortalUrl() {
        // Production: Use environment variable or config
        // Development: Default to localhost portal
        // Browser doesn't have process.env, so use default for now
        return 'http://localhost:8080';
    }
    
    /**
     * Initialize session from URL parameters or localStorage
     * Called on game startup to establish session state
     */
    async initializeSession() {
        console.log('🔐 Initializing session...');
        
        // Check URL parameters first (portal handoff)
        const urlToken = this.extractTokenFromUrl();
        if (urlToken) {
            console.log('🔐 Found session token in URL');
            this.setSessionToken(urlToken.token, urlToken.refreshToken, urlToken.expiry);
            this.cleanUrlParameters();
        } else {
            // Check localStorage for existing session
            this.loadStoredSession();
        }
        
        // Validate current session
        const isValid = await this.validateSession();
        if (isValid) {
            this.startAutoRefresh();
            return { success: true, authenticated: true };
        } else {
            return { success: false, authenticated: false, redirectToPortal: true };
        }
    }
    
    /**
     * Extract session token from URL parameters
     * Used when portal redirects to game client with session
     */
    extractTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('session_token');
        const refreshToken = urlParams.get('refresh_token');
        const expiry = urlParams.get('expires_at');
        
        if (token && refreshToken && expiry) {
            return {
                token: token,
                refreshToken: refreshToken,
                expiry: parseInt(expiry, 10)
            };
        }
        
        return null;
    }
    
    /**
     * Clean session parameters from URL for security
     */
    cleanUrlParameters() {
        const url = new URL(window.location);
        url.searchParams.delete('session_token');
        url.searchParams.delete('refresh_token');
        url.searchParams.delete('expires_at');
        
        // Update URL without reloading page
        window.history.replaceState({}, '', url.toString());
        console.log('🔐 Cleaned session parameters from URL');
    }
    
    /**
     * Load session from localStorage
     */
    loadStoredSession() {
        try {
            const sessionData = localStorage.getItem('infinity_storm_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                if (session.token && session.expiry && Date.now() < session.expiry) {
                    this.sessionToken = session.token;
                    this.refreshToken = session.refreshToken;
                    this.sessionExpiry = session.expiry;
                    this.refreshExpiry = session.refreshExpiry;
                    console.log('🔐 Loaded valid session from storage');
                    return true;
                } else {
                    console.log('🔐 Stored session expired, clearing');
                    this.clearSession();
                }
            }
        } catch (error) {
            console.error('🔐 Error loading stored session:', error);
            this.clearSession();
        }
        return false;
    }
    
    /**
     * Store session in localStorage
     */
    storeSession() {
        if (!this.sessionToken) return;
        
        const sessionData = {
            token: this.sessionToken,
            refreshToken: this.refreshToken,
            expiry: this.sessionExpiry,
            refreshExpiry: this.refreshExpiry,
            storedAt: Date.now()
        };
        
        try {
            localStorage.setItem('infinity_storm_session', JSON.stringify(sessionData));
            console.log('🔐 Session stored successfully');
        } catch (error) {
            console.error('🔐 Error storing session:', error);
        }
    }
    
    /**
     * Set session token and metadata
     */
    setSessionToken(token, refreshToken, expiry) {
        this.sessionToken = token;
        this.refreshToken = refreshToken;
        this.sessionExpiry = expiry;
        this.refreshExpiry = expiry + (7 * 24 * 60 * 60 * 1000); // Refresh valid for 7 days
        
        // Store in localStorage
        this.storeSession();
        
        // Update NetworkService
        if (window.NetworkService) {
            window.NetworkService.setAuthToken(token);
        }
        
        console.log('🔐 Session token set, expires:', new Date(expiry));
    }
    
    /**
     * Clear all session data
     */
    clearSession() {
        this.sessionToken = null;
        this.refreshToken = null;
        this.sessionExpiry = null;
        this.refreshExpiry = null;
        
        localStorage.removeItem('infinity_storm_session');
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        // Clear NetworkService token
        if (window.NetworkService) {
            window.NetworkService.setAuthToken(null);
        }
        
        console.log('🔐 Session cleared');
    }
    
    /**
     * Validate current session with server
     */
    async validateSession(retries = 0) {
        if (!this.sessionToken) {
            console.log('🔐 No session token to validate');
            return false;
        }
        
        if (this.isValidating) {
            console.log('🔐 Session validation already in progress');
            return false;
        }
        
        this.isValidating = true;
        
        try {
            console.log('🔐 Validating session with server...');
            
            // Check expiry locally first
            if (Date.now() >= this.sessionExpiry) {
                console.log('🔐 Session expired locally');
                this.clearSession();
                return false;
            }
            
            // Validate with server
            const response = await fetch('http://localhost:3000/api/validate-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                timeout: 10000
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    console.log('🔐 ✅ Session validated successfully');
                    return true;
                } else {
                    console.log('🔐 ❌ Session validation failed:', data.message);
                    this.clearSession();
                    return false;
                }
            } else if (response.status === 401) {
                console.log('🔐 ❌ Session unauthorized, attempting refresh');
                return await this.refreshSession();
            } else {
                console.log('🔐 ❌ Session validation error:', response.status);
                if (retries < this.MAX_VALIDATION_RETRIES) {
                    console.log(`🔐 Retrying validation (${retries + 1}/${this.MAX_VALIDATION_RETRIES})`);
                    await this.delay(2000 * (retries + 1));
                    return await this.validateSession(retries + 1);
                }
                return false;
            }
        } catch (error) {
            console.error('🔐 Session validation error:', error);
            if (retries < this.MAX_VALIDATION_RETRIES) {
                console.log(`🔐 Retrying validation (${retries + 1}/${this.MAX_VALIDATION_RETRIES})`);
                await this.delay(2000 * (retries + 1));
                return await this.validateSession(retries + 1);
            }
            return false;
        } finally {
            this.isValidating = false;
        }
    }
    
    /**
     * Refresh session using refresh token
     */
    async refreshSession() {
        if (!this.refreshToken) {
            console.log('🔐 No refresh token available');
            return false;
        }
        
        if (Date.now() >= this.refreshExpiry) {
            console.log('🔐 Refresh token expired');
            this.clearSession();
            return false;
        }
        
        try {
            console.log('🔐 Refreshing session...');
            
            const response = await fetch('http://localhost:3000/api/refresh-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.refreshToken}`
                },
                timeout: 10000
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.sessionToken) {
                    console.log('🔐 ✅ Session refreshed successfully');
                    this.setSessionToken(
                        data.sessionToken,
                        data.refreshToken || this.refreshToken,
                        data.expiresAt
                    );
                    return true;
                } else {
                    console.log('🔐 ❌ Session refresh failed:', data.message);
                    this.clearSession();
                    return false;
                }
            } else {
                console.log('🔐 ❌ Session refresh error:', response.status);
                this.clearSession();
                return false;
            }
        } catch (error) {
            console.error('🔐 Session refresh error:', error);
            return false;
        }
    }
    
    /**
     * Start automatic session refresh
     */
    startAutoRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        if (!this.sessionExpiry) return;
        
        const timeToRefresh = this.sessionExpiry - Date.now() - this.REFRESH_BUFFER;
        if (timeToRefresh > 0) {
            this.refreshTimer = setTimeout(() => {
                console.log('🔐 Auto-refreshing session');
                this.refreshSession().then(success => {
                    if (success) {
                        this.startAutoRefresh(); // Schedule next refresh
                    } else {
                        this.redirectToPortal('session_expired');
                    }
                });
            }, timeToRefresh);
            
            console.log(`🔐 Auto-refresh scheduled in ${Math.round(timeToRefresh / 1000)}s`);
        } else {
            // Need to refresh immediately
            this.refreshSession().then(success => {
                if (success) {
                    this.startAutoRefresh();
                } else {
                    this.redirectToPortal('session_expired');
                }
            });
        }
    }
    
    /**
     * Check if session needs refresh soon
     */
    needsRefresh() {
        if (!this.sessionExpiry) return false;
        return (this.sessionExpiry - Date.now()) < this.REFRESH_BUFFER;
    }
    
    /**
     * Get session status
     */
    getSessionStatus() {
        const now = Date.now();
        return {
            authenticated: !!this.sessionToken,
            hasToken: !!this.sessionToken,
            hasRefreshToken: !!this.refreshToken,
            expiresIn: this.sessionExpiry ? Math.max(0, this.sessionExpiry - now) : 0,
            needsRefresh: this.needsRefresh(),
            isValidating: this.isValidating
        };
    }
    
    /**
     * Redirect to portal for authentication
     */
    redirectToPortal(reason = 'authentication_required') {
        console.log(`🔐 Would redirect to portal: ${reason} (disabled for testing)`);
        
        // Clear any invalid session data
        this.clearSession();
        
        // For testing: Don't redirect, just log what would happen
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.delete('session_token');
        returnUrl.searchParams.delete('refresh_token');
        returnUrl.searchParams.delete('expires_at');
        
        const portalUrl = new URL('/auth/login', this.portalUrl);
        portalUrl.searchParams.set('return_url', returnUrl.toString());
        portalUrl.searchParams.set('reason', reason);
        
        console.log(`🔐 Would redirect to: ${portalUrl.toString()}`);
        console.log(`🔐 Portal redirect disabled for testing - game will continue in demo mode`);
        
        // Instead of redirecting, return false to indicate no session
        return false;
    }
    
    /**
     * Handle session expiry
     */
    handleSessionExpiry() {
        console.log('🔐 Session expired');
        this.clearSession();
        this.redirectToPortal('session_expired');
    }
    
    /**
     * Manual session logout
     */
    async logout() {
        console.log('🔐 Logging out...');
        
        if (this.sessionToken) {
            try {
                // Notify server of logout
                await fetch('http://localhost:3000/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.sessionToken}`
                    },
                    timeout: 5000
                });
            } catch (error) {
                console.log('🔐 Logout notification failed:', error);
            }
        }
        
        this.clearSession();
        this.redirectToPortal('logged_out');
    }
    
    /**
     * Get current session token
     */
    getSessionToken() {
        return this.sessionToken;
    }
    
    /**
     * Check if currently authenticated
     */
    isAuthenticated() {
        return !!this.sessionToken && Date.now() < this.sessionExpiry;
    }
    
    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
})();