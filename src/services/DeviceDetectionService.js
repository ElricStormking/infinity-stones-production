// Device Detection Service for mobile/tablet detection and capabilities
// Uses global window pattern for Phaser compatibility
window.DeviceDetectionService = class DeviceDetectionService {
    constructor() {
        // Cache detection results to avoid repeated calculations
        this._cache = {
            isMobile: null,
            isTablet: null,
            isIOS: null,
            isAndroid: null,
            orientation: null
        };
        
        // Initialize detection on creation
        this._detectDevice();
    }
    
    // Core detection method
    _detectDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        // Mobile detection using multiple checks for accuracy
        this._cache.isMobile = this._checkMobile(userAgent);
        
        // Tablet detection (larger mobile devices)
        this._cache.isTablet = this._checkTablet(userAgent);
        
        // Platform detection
        this._cache.isIOS = this._checkIOS(userAgent);
        this._cache.isAndroid = this._checkAndroid(userAgent);
    }
    
    // Check if device is mobile (phone or small device)
    _checkMobile(userAgent) {
        // Primary check: User agent patterns
        const mobileRegex = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const isMobileUA = mobileRegex.test(userAgent);
        
        // Secondary check: Touch capability
        const hasTouch = ('ontouchstart' in window) || 
                        (navigator.maxTouchPoints > 0) || 
                        (navigator.msMaxTouchPoints > 0);
        
        // Tertiary check: Viewport width (mobile typically < 768px)
        const isMobileWidth = window.innerWidth < 768;
        
        // Combine checks - mobile if UA matches AND has touch, OR very narrow screen with touch
        return (isMobileUA && hasTouch) || (isMobileWidth && hasTouch);
    }
    
    // Check if device is tablet (larger touch device)
    _checkTablet(userAgent) {
        const tabletRegex = /iPad|Android(?!.*Mobile)|Tablet|tablet|playbook|silk/i;
        const isTabletUA = tabletRegex.test(userAgent);
        
        // Additional check for larger touch screens
        const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isTabletSize = window.innerWidth >= 768 && window.innerWidth <= 1024;
        
        return isTabletUA || (hasTouch && isTabletSize);
    }
    
    // Check if iOS device
    _checkIOS(userAgent) {
        const iosRegex = /iPad|iPhone|iPod/i;
        return iosRegex.test(userAgent) && !window.MSStream;
    }
    
    // Check if Android device
    _checkAndroid(userAgent) {
        return /Android/i.test(userAgent);
    }
    
    // Public API Methods
    
    // Check if device is mobile
    isMobile() {
        if (this._cache.isMobile === null) {
            this._detectDevice();
        }
        return this._cache.isMobile;
    }
    
    // Check if device is tablet
    isTablet() {
        if (this._cache.isTablet === null) {
            this._detectDevice();
        }
        return this._cache.isTablet;
    }
    
    // Check if device is iOS
    isIOS() {
        if (this._cache.isIOS === null) {
            this._detectDevice();
        }
        return this._cache.isIOS;
    }
    
    // Check if device is Android
    isAndroid() {
        if (this._cache.isAndroid === null) {
            this._detectDevice();
        }
        return this._cache.isAndroid;
    }
    
    // Check if device is mobile or tablet
    isMobileOrTablet() {
        return this.isMobile() || this.isTablet();
    }
    
    // Get current orientation
    getOrientation() {
        // Use multiple methods for better compatibility
        
        // Method 1: window.orientation (deprecated but still widely used)
        if (window.orientation !== undefined) {
            return Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait';
        }
        
        // Method 2: Screen Orientation API (modern browsers)
        if (screen && screen.orientation && screen.orientation.type) {
            return screen.orientation.type.includes('landscape') ? 'landscape' : 'portrait';
        }
        
        // Method 3: MediaQuery as fallback
        if (window.matchMedia) {
            const isPortrait = window.matchMedia("(orientation: portrait)").matches;
            return isPortrait ? 'portrait' : 'landscape';
        }
        
        // Method 4: Window dimensions as last resort
        return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }
    
    // Check if device is in portrait mode
    isPortrait() {
        return this.getOrientation() === 'portrait';
    }
    
    // Check if device is in landscape mode
    isLandscape() {
        return this.getOrientation() === 'landscape';
    }
    
    // Get comprehensive device information
    getDeviceInfo() {
        return {
            isMobile: this.isMobile(),
            isTablet: this.isTablet(),
            isMobileOrTablet: this.isMobileOrTablet(),
            isIOS: this.isIOS(),
            isAndroid: this.isAndroid(),
            orientation: this.getOrientation(),
            isPortrait: this.isPortrait(),
            isLandscape: this.isLandscape(),
            hasTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            userAgent: navigator.userAgent
        };
    }
    
    // Check if device supports orientation change
    supportsOrientationChange() {
        return 'orientation' in window || 'orientation' in screen;
    }
    
    // Get viewport dimensions
    getViewportDimensions() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            aspectRatio: window.innerWidth / window.innerHeight
        };
    }
    
    // Check if device has notch (iPhone X and later)
    hasNotch() {
        // Check for iOS devices with notch using safe area insets
        if (this.isIOS()) {
            const hasNotchCSS = CSS.supports('padding-top: env(safe-area-inset-top)');
            const screenRatio = window.screen.height / window.screen.width;
            // iPhone X and later have specific aspect ratios
            const isIPhoneXRatio = screenRatio > 2.1;
            return hasNotchCSS && isIPhoneXRatio;
        }
        return false;
    }
    
    // Force refresh of cached values
    refresh() {
        this._cache = {
            isMobile: null,
            isTablet: null,
            isIOS: null,
            isAndroid: null,
            orientation: null
        };
        this._detectDevice();
    }
    
    // Debug method to log device info
    debug() {
        console.log('📱 Device Detection Info:', this.getDeviceInfo());
    }
}

// Create singleton instance
window.deviceDetection = new window.DeviceDetectionService();