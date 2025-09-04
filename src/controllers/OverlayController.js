// Overlay Controller for managing orientation overlay visibility and animations
// Uses global window pattern for Phaser compatibility
window.OverlayController = class OverlayController {
    constructor() {
        // DOM element references
        this.overlay = null;
        this.isVisible = false;
        this.isAnimating = false;
        
        // Animation settings
        this.fadeInDuration = 300; // milliseconds
        this.fadeOutDuration = 300; // milliseconds
        
        // Initialize on creation
        this._initialize();
    }
    
    // Initialize the controller and cache DOM elements
    _initialize() {
        console.log('🎨 Initializing OverlayController...');
        
        // Cache overlay element
        this.overlay = document.getElementById('orientation-overlay');
        
        if (!this.overlay) {
            console.warn('🎨 Orientation overlay element not found in DOM');
            return;
        }
        
        // Ensure overlay is initially hidden
        this.overlay.style.display = 'none';
        this.overlay.classList.remove('visible');
        
        console.log('🎨 OverlayController initialized');
    }
    
    // Show the overlay with fade-in animation
    show() {
        if (this.isAnimating || this.isVisible) {
            console.log('🎨 Overlay already visible or animating, skipping show');
            return Promise.resolve();
        }
        
        console.log('🎨 Showing orientation overlay...');
        
        if (!this.overlay) {
            console.warn('🎨 Overlay element not available');
            return Promise.reject(new Error('Overlay element not found'));
        }
        
        return new Promise((resolve) => {
            this.isAnimating = true;
            
            // Set initial state for animation
            this.overlay.style.display = 'flex';
            this.overlay.classList.remove('visible');
            
            // Force a reflow to ensure display change is applied
            this.overlay.offsetHeight;
            
            // Add visible class to trigger CSS transition
            this.overlay.classList.add('visible');
            
            // Wait for animation to complete
            setTimeout(() => {
                this.isVisible = true;
                this.isAnimating = false;
                console.log('🎨 Overlay show animation completed');
                resolve();
            }, this.fadeInDuration);
        });
    }
    
    // Hide the overlay with fade-out animation
    hide() {
        if (this.isAnimating || !this.isVisible) {
            console.log('🎨 Overlay already hidden or animating, skipping hide');
            return Promise.resolve();
        }
        
        console.log('🎨 Hiding orientation overlay...');
        
        if (!this.overlay) {
            console.warn('🎨 Overlay element not available');
            return Promise.reject(new Error('Overlay element not found'));
        }
        
        return new Promise((resolve) => {
            this.isAnimating = true;
            
            // Remove visible class to trigger CSS transition
            this.overlay.classList.remove('visible');
            
            // Wait for animation to complete before hiding
            setTimeout(() => {
                this.overlay.style.display = 'none';
                this.isVisible = false;
                this.isAnimating = false;
                console.log('🎨 Overlay hide animation completed');
                resolve();
            }, this.fadeOutDuration);
        });
    }
    
    // Toggle overlay visibility
    toggle() {
        if (this.isVisible || this.isAnimating) {
            return this.hide();
        } else {
            return this.show();
        }
    }
    
    // Check if overlay is currently visible
    isOverlayVisible() {
        return this.isVisible;
    }
    
    // Check if overlay is currently animating
    isOverlayAnimating() {
        return this.isAnimating;
    }
    
    // Force show without animation (for testing)
    showImmediate() {
        if (!this.overlay) {
            console.warn('🎨 Overlay element not available');
            return;
        }
        
        console.log('🎨 Showing overlay immediately (no animation)');
        this.overlay.style.display = 'flex';
        this.overlay.classList.add('visible');
        this.isVisible = true;
        this.isAnimating = false;
    }
    
    // Force hide without animation (for testing)
    hideImmediate() {
        if (!this.overlay) {
            console.warn('🎨 Overlay element not available');
            return;
        }
        
        console.log('🎨 Hiding overlay immediately (no animation)');
        this.overlay.style.display = 'none';
        this.overlay.classList.remove('visible');
        this.isVisible = false;
        this.isAnimating = false;
    }
    
    // Update overlay content (for customization)
    updateContent(options = {}) {
        if (!this.overlay) {
            console.warn('🎨 Overlay element not available');
            return;
        }
        
        const textElement = this.overlay.querySelector('.orientation-text');
        const subtitleElement = this.overlay.querySelector('.orientation-subtitle');
        
        if (options.mainText && textElement) {
            textElement.textContent = options.mainText;
        }
        
        if (options.subtitle && subtitleElement) {
            subtitleElement.textContent = options.subtitle;
        }
        
        console.log('🎨 Overlay content updated');
    }
    
    // Set animation durations
    setAnimationDuration(fadeIn, fadeOut) {
        this.fadeInDuration = fadeIn || this.fadeInDuration;
        this.fadeOutDuration = fadeOut || this.fadeOutDuration;
        console.log(`🎨 Animation durations set: fadeIn=${this.fadeInDuration}ms, fadeOut=${this.fadeOutDuration}ms`);
    }
    
    // Add custom CSS class to overlay
    addClass(className) {
        if (this.overlay && className) {
            this.overlay.classList.add(className);
        }
    }
    
    // Remove custom CSS class from overlay
    removeClass(className) {
        if (this.overlay && className) {
            this.overlay.classList.remove(className);
        }
    }
    
    // Get current state
    getState() {
        return {
            isVisible: this.isVisible,
            isAnimating: this.isAnimating,
            hasOverlayElement: !!this.overlay,
            fadeInDuration: this.fadeInDuration,
            fadeOutDuration: this.fadeOutDuration
        };
    }
    
    // Refresh DOM element reference (useful if DOM changes)
    refresh() {
        console.log('🎨 Refreshing OverlayController DOM references...');
        this.overlay = document.getElementById('orientation-overlay');
        
        if (this.overlay) {
            console.log('🎨 Overlay element found and cached');
        } else {
            console.warn('🎨 Overlay element not found after refresh');
        }
    }
    
    // Debug method to log current state
    debug() {
        console.log('🎨 OverlayController State:', this.getState());
        if (this.overlay) {
            console.log('🎨 Overlay DOM state:', {
                display: this.overlay.style.display,
                visibility: window.getComputedStyle(this.overlay).visibility,
                opacity: window.getComputedStyle(this.overlay).opacity,
                hasVisibleClass: this.overlay.classList.contains('visible')
            });
        }
    }
    
    // Destroy the controller
    destroy() {
        console.log('🎨 Destroying OverlayController...');
        
        // Hide overlay if visible
        if (this.isVisible) {
            this.hideImmediate();
        }
        
        // Clear references
        this.overlay = null;
        this.isVisible = false;
        this.isAnimating = false;
    }
}

// Create singleton instance
window.overlayController = new window.OverlayController();