// NetworkService - Simple network service for server communication
window.NetworkService = {
    baseURL: 'http://localhost:3000',
    authToken: null,
    
    init() {
        // Get stored token if any
        this.authToken = localStorage.getItem('infinity_storm_token');
    },
    
    setAuthToken(token) {
        this.authToken = token;
        if (token) {
            localStorage.setItem('infinity_storm_token', token);
        } else {
            localStorage.removeItem('infinity_storm_token');
        }
    },
    
    getStoredToken() {
        return localStorage.getItem('infinity_storm_token');
    },
    
    async makeRequest(method, endpoint, data = null) {
        try {
            const config = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            if (this.authToken) {
                config.headers.Authorization = `Bearer ${this.authToken}`;
            }
            
            if (data) {
                config.body = JSON.stringify(data);
            }
            
            const response = await fetch(this.baseURL + endpoint, config);
            const responseData = await response.json();
            
            if (!response.ok) {
                // Handle error responses from server
                return {
                    success: false,
                    error: responseData.error || responseData.message || 'Request failed',
                    details: responseData.details || null,
                    status: response.status
                };
            }
            
            return responseData; // Server already sends { success: true, data: ... }
        } catch (error) {
            console.error(`HTTP ${method} ${endpoint} failed:`, error);
            return { 
                success: false, 
                error: error.message || 'Network error',
                status: error.status || 500
            };
        }
    },
    
    async get(endpoint) {
        return this.makeRequest('GET', endpoint);
    },
    
    async post(endpoint, data) {
        return this.makeRequest('POST', endpoint, data);
    },
    
    async put(endpoint, data) {
        return this.makeRequest('PUT', endpoint, data);
    },
    
    async delete(endpoint) {
        return this.makeRequest('DELETE', endpoint);
    },
    
    // Simple event system
    eventHandlers: new Map(),
    
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    },
    
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    },
    
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    },
    
    isSocketConnected() {
        return false; // Simple version doesn't use WebSocket
    },
    
    getConnectionStatus() {
        return {
            connected: true,
            authenticated: !!this.authToken,
            socketId: null
        };
    }
};

// Initialize on load
window.NetworkService.init(); 