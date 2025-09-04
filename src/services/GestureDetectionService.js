// Gesture Detection Service for mobile touch interactions
// Uses global window pattern for Phaser compatibility
window.GestureDetectionService = class GestureDetectionService {
    constructor() {
        this.isEnabled = false;
        this.touches = new Map();
        this.gestures = {
            swipe: [],
            hold: [],
            tap: []
        };
        
        // Configuration
        this.config = {
            swipeThreshold: 50, // minimum distance for swipe
            swipeTimeout: 500, // maximum time for swipe (ms)
            holdTimeout: 800, // minimum time for hold gesture (ms)
            tapTimeout: 200 // maximum time for tap (ms)
        };
        
        // Event listeners
        this.boundHandlers = {
            pointerdown: this.handlePointerDown.bind(this),
            pointermove: this.handlePointerMove.bind(this),
            pointerup: this.handlePointerUp.bind(this)
        };
    }
    
    // Initialize gesture detection (only on mobile devices)
    init() {
        if (window.deviceDetection && window.deviceDetection.isMobileOrTablet()) {
            console.log('📱 Initializing gesture detection for mobile...');
            this.enable();
        } else {
            console.log('📱 Skipping gesture detection - not a mobile device');
        }
    }
    
    // Enable gesture detection
    enable() {
        if (this.isEnabled) return;
        
        this.isEnabled = true;
        
        // Add global event listeners
        document.addEventListener('pointerdown', this.boundHandlers.pointerdown, { passive: false });
        document.addEventListener('pointermove', this.boundHandlers.pointermove, { passive: false });
        document.addEventListener('pointerup', this.boundHandlers.pointerup, { passive: false });
        
        console.log('📱 Gesture detection enabled');
    }
    
    // Disable gesture detection
    disable() {
        if (!this.isEnabled) return;
        
        this.isEnabled = false;
        
        // Remove global event listeners
        document.removeEventListener('pointerdown', this.boundHandlers.pointerdown);
        document.removeEventListener('pointermove', this.boundHandlers.pointermove);
        document.removeEventListener('pointerup', this.boundHandlers.pointerup);
        
        // Clear active touches
        this.touches.clear();
        
        console.log('📱 Gesture detection disabled');
    }
    
    // Handle pointer down
    handlePointerDown(event) {
        const touch = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            currentX: event.clientX,
            currentY: event.clientY,
            startTime: Date.now(),
            moved: false,
            element: event.target
        };
        
        this.touches.set(event.pointerId, touch);
        
        // Start hold timer
        touch.holdTimer = setTimeout(() => {
            this.detectHold(touch);
        }, this.config.holdTimeout);
    }
    
    // Handle pointer move
    handlePointerMove(event) {
        const touch = this.touches.get(event.pointerId);
        if (!touch) return;
        
        touch.currentX = event.clientX;
        touch.currentY = event.clientY;
        touch.moved = true;
        
        // Cancel hold if moved too much
        const distance = this.getDistance(touch.startX, touch.startY, touch.currentX, touch.currentY);
        if (distance > 10 && touch.holdTimer) {
            clearTimeout(touch.holdTimer);
            touch.holdTimer = null;
        }
    }
    
    // Handle pointer up
    handlePointerUp(event) {
        const touch = this.touches.get(event.pointerId);
        if (!touch) return;
        
        const endTime = Date.now();
        const duration = endTime - touch.startTime;
        const distance = this.getDistance(touch.startX, touch.startY, touch.currentX, touch.currentY);
        
        // Clear hold timer
        if (touch.holdTimer) {
            clearTimeout(touch.holdTimer);
        }
        
        // Detect gesture type
        if (!touch.moved && duration < this.config.tapTimeout) {
            this.detectTap(touch, event);
        } else if (distance > this.config.swipeThreshold && duration < this.config.swipeTimeout) {
            this.detectSwipe(touch, event);
        }
        
        // Clean up
        this.touches.delete(event.pointerId);
    }
    
    // Detect tap gesture
    detectTap(touch, event) {
        const gesture = {
            type: 'tap',
            x: touch.startX,
            y: touch.startY,
            element: touch.element,
            timestamp: Date.now()
        };
        
        this.dispatchGesture('tap', gesture);
    }
    
    // Detect swipe gesture
    detectSwipe(touch, event) {
        const deltaX = touch.currentX - touch.startX;
        const deltaY = touch.currentY - touch.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Determine swipe direction
        let direction = 'unknown';
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left';
        } else {
            direction = deltaY > 0 ? 'down' : 'up';
        }
        
        const gesture = {
            type: 'swipe',
            direction: direction,
            distance: distance,
            deltaX: deltaX,
            deltaY: deltaY,
            startX: touch.startX,
            startY: touch.startY,
            endX: touch.currentX,
            endY: touch.currentY,
            element: touch.element,
            timestamp: Date.now()
        };
        
        this.dispatchGesture('swipe', gesture);
    }
    
    // Detect hold gesture
    detectHold(touch) {
        const gesture = {
            type: 'hold',
            x: touch.startX,
            y: touch.startY,
            element: touch.element,
            timestamp: Date.now()
        };
        
        this.dispatchGesture('hold', gesture);
    }
    
    // Dispatch gesture event
    dispatchGesture(type, gesture) {
        console.log(`📱 Gesture detected: ${type}`, gesture);
        
        // Dispatch custom event
        const event = new CustomEvent(`gesture:${type}`, {
            detail: gesture,
            bubbles: true
        });
        
        document.dispatchEvent(event);
        
        // Call registered callbacks
        this.gestures[type].forEach(callback => {
            try {
                callback(gesture);
            } catch (error) {
                console.error(`📱 Error in ${type} gesture callback:`, error);
            }
        });
    }
    
    // Register gesture callback
    on(gestureType, callback) {
        if (typeof callback === 'function' && this.gestures[gestureType]) {
            this.gestures[gestureType].push(callback);
        }
    }
    
    // Unregister gesture callback
    off(gestureType, callback) {
        if (this.gestures[gestureType]) {
            const index = this.gestures[gestureType].indexOf(callback);
            if (index > -1) {
                this.gestures[gestureType].splice(index, 1);
            }
        }
    }
    
    // Utility function to calculate distance
    getDistance(x1, y1, x2, y2) {
        const deltaX = x2 - x1;
        const deltaY = y2 - y1;
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }
    
    // Get current configuration
    getConfig() {
        return { ...this.config };
    }
    
    // Update configuration
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    
    // Get gesture statistics
    getStats() {
        return {
            isEnabled: this.isEnabled,
            activeTouches: this.touches.size,
            callbackCounts: {
                swipe: this.gestures.swipe.length,
                hold: this.gestures.hold.length,
                tap: this.gestures.tap.length
            }
        };
    }
    
    // Clean up
    destroy() {
        this.disable();
        
        // Clear all callbacks
        this.gestures.swipe = [];
        this.gestures.hold = [];
        this.gestures.tap = [];
    }
}

// Create singleton instance
window.gestureDetection = new window.GestureDetectionService();