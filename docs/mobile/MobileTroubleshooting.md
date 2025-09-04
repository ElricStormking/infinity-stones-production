# Mobile Troubleshooting Guide
## Infinity Storm - Mobile Issues Diagnosis and Resolution

### Overview

This comprehensive troubleshooting guide helps developers, support staff, and advanced users diagnose and resolve common issues with the Infinity Storm mobile horizontal layout system. It includes diagnostic tools, step-by-step solutions, and preventive measures.

---

## Table of Contents

1. [Quick Diagnostic Tools](#quick-diagnostic-tools)
2. [Orientation Issues](#orientation-issues)
3. [Touch Input Problems](#touch-input-problems)
4. [Performance Issues](#performance-issues)
5. [Browser Compatibility Problems](#browser-compatibility-problems)
6. [Device-Specific Issues](#device-specific-issues)
7. [Network and Connectivity Issues](#network-and-connectivity-issues)
8. [Audio and Visual Problems](#audio-and-visual-problems)
9. [Advanced Debugging](#advanced-debugging)
10. [Preventive Measures](#preventive-measures)
11. [Support and Escalation](#support-and-escalation)

---

## Quick Diagnostic Tools

### Browser Console Diagnostics

#### Basic System Check
```javascript
// Run in browser console for immediate diagnostic info
console.log('=== INFINITY STORM MOBILE DIAGNOSTICS ===');

// 1. Mobile System Status
console.log('Device Detection:', window.deviceDetection?.getDeviceInfo());
console.log('Orientation State:', window.orientationManager?.getState());
console.log('Overlay State:', window.overlayController?.getState());

// 2. Browser Compatibility
console.log('User Agent:', navigator.userAgent);
console.log('Touch Support:', 'ontouchstart' in window);
console.log('Orientation APIs:', {
    windowOrientation: 'orientation' in window,
    screenOrientation: 'orientation' in screen,
    matchMedia: 'matchMedia' in window
});

// 3. Current Game State
if (window.game) {
    console.log('Game State:', {
        scenes: window.game.scene.keys,
        activeScene: window.game.scene.getScenes(true).map(s => s.scene.key)
    });
}

// 4. Performance Metrics
if (performance.memory) {
    console.log('Memory Usage:', {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
    });
}
```

#### Mobile Test Suite Quick Check
```javascript
// Quick mobile functionality test
if (window.MobileTestSuite) {
    const quickTest = async () => {
        const testSuite = new window.MobileTestSuite();
        testSuite.init({ 
            enablePerformanceTests: false,
            enableTouchTests: false
        });
        
        // Run critical tests only
        await testSuite.runDeviceDetectionTests();
        await testSuite.runOrientationTests();
        
        const report = testSuite.generateTestReport();
        console.log('Quick Test Results:', {
            successRate: report.summary.successRate + '%',
            passed: report.summary.passed,
            failed: report.summary.failed
        });
        
        return report;
    };
    
    quickTest().catch(console.error);
} else {
    console.warn('MobileTestSuite not available for quick testing');
}
```

### Visual Diagnostic Indicator

```javascript
// Add visual diagnostic indicator to page
function addDiagnosticIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'mobile-diagnostic-indicator';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #333;
        color: #fff;
        padding: 8px;
        border-radius: 4px;
        font-size: 11px;
        font-family: monospace;
        z-index: 10001;
        max-width: 200px;
    `;
    
    const updateIndicator = () => {
        const info = [];
        
        if (window.deviceDetection) {
            info.push(`Device: ${window.deviceDetection.isMobile() ? 'Mobile' : 'Desktop'}`);
            info.push(`Orientation: ${window.deviceDetection.getOrientation()}`);
        }
        
        if (window.orientationManager) {
            const state = window.orientationManager.getState();
            info.push(`Overlay: ${state.overlayVisible ? 'Visible' : 'Hidden'}`);
            info.push(`Paused: ${state.gamePaused ? 'Yes' : 'No'}`);
        }
        
        if (performance.memory) {
            const memMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            info.push(`Memory: ${memMB}MB`);
        }
        
        indicator.innerHTML = info.join('<br>');
    };
    
    updateIndicator();
    setInterval(updateIndicator, 1000);
    
    document.body.appendChild(indicator);
}

// Run diagnostic indicator
addDiagnosticIndicator();
```

---

## Orientation Issues

### Issue: Orientation Overlay Won't Appear

#### Symptoms:
- Game doesn't prompt to rotate device in portrait mode
- Mobile device detected but no overlay shown
- Game continues running in portrait orientation

#### Diagnosis:
```javascript
// Check orientation system status
console.log('Orientation Diagnosis:', {
    deviceDetected: window.deviceDetection?.isMobileOrTablet(),
    currentOrientation: window.deviceDetection?.getOrientation(),
    managerInitialized: window.orientationManager?.gameInitialized,
    overlayVisible: window.orientationManager?.overlayVisible,
    overlayElement: !!document.getElementById('orientation-overlay')
});

// Check configuration
console.log('Config Check:', {
    enforceLandscape: window.GameConfig?.MOBILE?.ORIENTATION?.ENFORCE_LANDSCAPE,
    showPrompt: window.GameConfig?.MOBILE?.ORIENTATION?.SHOW_ROTATION_PROMPT
});
```

#### Solutions:

**Solution 1: Verify Mobile Detection**
```javascript
// Force mobile detection refresh
window.deviceDetection.refresh();
window.deviceDetection.debug();

// Manual override if needed
if (!window.deviceDetection.isMobileOrTablet()) {
    // Temporarily override for testing
    const originalIsMobile = window.deviceDetection.isMobileOrTablet;
    window.deviceDetection.isMobileOrTablet = () => true;
    window.orientationManager.forceCheck();
}
```

**Solution 2: Check DOM Element**
```javascript
// Verify overlay DOM element exists
const overlay = document.getElementById('orientation-overlay');
if (!overlay) {
    console.error('Orientation overlay element missing from DOM');
    // Create overlay element if missing
    createMissingOverlayElement();
}

function createMissingOverlayElement() {
    const overlay = document.createElement('div');
    overlay.id = 'orientation-overlay';
    overlay.innerHTML = `
        <div class="orientation-content">
            <div class="rotation-icon">🔄</div>
            <h2 class="orientation-text">Rotate Your Device</h2>
            <p class="orientation-subtitle">Please turn to landscape mode</p>
        </div>
    `;
    overlay.className = 'orientation-overlay';
    document.body.appendChild(overlay);
    
    // Reinitialize overlay controller
    window.overlayController.refresh();
}
```

**Solution 3: Force Orientation Check**
```javascript
// Manual orientation check and overlay show
window.orientationManager.forceCheck();

// If still not working, manually trigger overlay
if (window.deviceDetection.isPortrait()) {
    window.overlayController.show();
}
```

### Issue: Orientation Overlay Won't Disappear

#### Symptoms:
- Overlay remains visible after rotating to landscape
- Game stays paused even in correct orientation
- Overlay stuck in showing state

#### Diagnosis:
```javascript
// Check overlay and orientation state
console.log('Overlay Stuck Diagnosis:', {
    overlayVisible: window.overlayController?.isOverlayVisible(),
    overlayAnimating: window.overlayController?.isOverlayAnimating(),
    currentOrientation: window.deviceDetection?.getOrientation(),
    gamePaused: window.orientationManager?.gamePaused,
    overlayControllerState: window.overlayController?.getState()
});

// Check for animation conflicts
console.log('Animation State:', {
    overlayElement: document.getElementById('orientation-overlay'),
    computedStyles: window.getComputedStyle(document.getElementById('orientation-overlay'))
});
```

#### Solutions:

**Solution 1: Force Hide Overlay**
```javascript
// Immediate overlay hide
window.overlayController.hideImmediate();

// Resume game if needed
if (window.orientationManager.gamePaused) {
    window.orientationManager.resumeGame();
}
```

**Solution 2: Reset Animation State**
```javascript
// Reset overlay animation state
const overlay = document.getElementById('orientation-overlay');
if (overlay) {
    overlay.classList.remove('visible');
    overlay.style.display = 'none';
    overlay.style.opacity = '0';
    
    // Reset controller state
    window.overlayController.isVisible = false;
    window.overlayController.isAnimating = false;
}
```

**Solution 3: Reinitialize Orientation System**
```javascript
// Complete orientation system reset
function resetOrientationSystem() {
    // Destroy existing instances
    if (window.orientationManager) {
        window.orientationManager.destroy();
    }
    
    // Recreate and reinitialize
    window.orientationManager = new window.OrientationManager();
    window.orientationManager.init({
        overlayController: window.overlayController
    });
    
    console.log('Orientation system reset complete');
}

resetOrientationSystem();
```

### Issue: Rapid Orientation Changes Cause Issues

#### Symptoms:
- Multiple overlays appearing simultaneously
- Game state confusion during rapid rotation
- Performance degradation during orientation changes

#### Diagnosis:
```javascript
// Check debouncing and event handling
console.log('Rapid Change Diagnosis:', {
    debounceDelay: window.orientationManager?.debounceDelay,
    debounceTimer: !!window.orientationManager?.debounceTimer,
    eventListeners: 'Check browser dev tools for event listener count'
});

// Monitor orientation changes
let changeCount = 0;
const originalHandler = window.orientationManager?._handleOrientationChange;
if (originalHandler) {
    window.orientationManager._handleOrientationChange = function() {
        changeCount++;
        console.log(`Orientation change #${changeCount} at ${Date.now()}`);
        return originalHandler.apply(this, arguments);
    };
}
```

#### Solutions:

**Solution 1: Increase Debounce Delay**
```javascript
// Increase debounce delay for stability
if (window.orientationManager) {
    window.orientationManager.debounceDelay = 500; // Increase from default 300ms
}
```

**Solution 2: Implement Change Throttling**
```javascript
// Add throttling to prevent excessive changes
let lastOrientationChange = 0;
const THROTTLE_DELAY = 1000; // 1 second minimum between changes

const originalProcessChange = window.orientationManager?._processOrientationChange;
if (originalProcessChange) {
    window.orientationManager._processOrientationChange = function() {
        const now = Date.now();
        if (now - lastOrientationChange < THROTTLE_DELAY) {
            console.log('Orientation change throttled');
            return;
        }
        lastOrientationChange = now;
        return originalProcessChange.apply(this, arguments);
    };
}
```

---

## Touch Input Problems

### Issue: Touch Events Not Registered

#### Symptoms:
- Taps/touches don't register in game
- No response to touch interactions
- Game works with mouse but not touch

#### Diagnosis:
```javascript
// Touch system diagnostic
console.log('Touch Diagnosis:', {
    touchSupport: 'ontouchstart' in window,
    maxTouchPoints: navigator.maxTouchPoints,
    gameInputEnabled: window.game?.input?.enabled,
    touchInputEnabled: window.game?.input?.touch?.enabled,
    phaseScene: window.game?.scene?.getScenes(true)[0]?.scene?.key
});

// Test touch event registration
let touchTestCount = 0;
document.addEventListener('touchstart', () => {
    touchTestCount++;
    console.log(`Touch test event #${touchTestCount}`);
}, { once: true });

console.log('Tap screen to test touch events...');
```

#### Solutions:

**Solution 1: Reinitialize Phaser Input**
```javascript
// Restart Phaser input system
if (window.game && window.game.input) {
    window.game.input.enabled = false;
    setTimeout(() => {
        window.game.input.enabled = true;
        if (window.game.input.touch) {
            window.game.input.touch.enabled = true;
        }
        console.log('Phaser input reinitialized');
    }, 100);
}
```

**Solution 2: Force Touch Context Creation**
```javascript
// Create touch context if missing
if (!('ontouchstart' in window) && window.game) {
    // Add touch event listeners manually
    const canvas = window.game.canvas;
    if (canvas) {
        ['touchstart', 'touchmove', 'touchend'].forEach(eventType => {
            canvas.addEventListener(eventType, (e) => {
                // Convert touch to mouse event
                const touch = e.touches[0] || e.changedTouches[0];
                const mouseEvent = new MouseEvent(eventType.replace('touch', 'mouse'), {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true
                });
                canvas.dispatchEvent(mouseEvent);
            });
        });
    }
}
```

### Issue: Touch Targets Too Small

#### Symptoms:
- Difficult to tap buttons accurately
- Frequent miss-taps
- Poor touch experience

#### Diagnosis:
```javascript
// Check touch target sizes
function checkTouchTargets() {
    const interactiveElements = document.querySelectorAll('button, [role="button"], .interactive');
    const smallTargets = [];
    
    interactiveElements.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const minSize = window.GameConfig?.MOBILE?.TOUCH?.MIN_TARGET_SIZE || 44;
        
        if (rect.width < minSize || rect.height < minSize) {
            smallTargets.push({
                index,
                element: element.tagName + (element.className ? '.' + element.className : ''),
                size: `${rect.width}x${rect.height}`,
                position: `${rect.left}, ${rect.top}`
            });
        }
    });
    
    console.log('Touch Target Analysis:', {
        totalTargets: interactiveElements.length,
        smallTargets: smallTargets.length,
        smallTargetDetails: smallTargets
    });
}

checkTouchTargets();
```

#### Solutions:

**Solution 1: Increase Touch Target Padding**
```javascript
// Add CSS to increase touch target sizes
const touchTargetCSS = `
    .touch-optimized button,
    .touch-optimized [role="button"],
    .touch-optimized .interactive {
        min-width: 44px !important;
        min-height: 44px !important;
        padding: 12px !important;
        margin: 8px !important;
    }
    
    @media (max-width: 768px) {
        button, [role="button"], .interactive {
            min-width: 56px !important;
            min-height: 56px !important;
        }
    }
`;

const style = document.createElement('style');
style.textContent = touchTargetCSS;
document.head.appendChild(style);
document.body.classList.add('touch-optimized');
```

### Issue: Touch Lag or Unresponsiveness

#### Symptoms:
- Delayed response to touches
- Touch events seem to "stick"
- Poor touch performance

#### Diagnosis:
```javascript
// Measure touch response latency
let touchStartTime = 0;
let responseTimes = [];

document.addEventListener('touchstart', (e) => {
    touchStartTime = performance.now();
});

document.addEventListener('touchend', (e) => {
    const responseTime = performance.now() - touchStartTime;
    responseTimes.push(responseTime);
    
    if (responseTimes.length > 10) {
        const avgResponse = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
        console.log(`Average touch response: ${avgResponse.toFixed(1)}ms`);
        responseTimes = responseTimes.slice(-5); // Keep last 5
    }
});
```

#### Solutions:

**Solution 1: Enable Passive Event Listeners**
```javascript
// Use passive event listeners for better performance
function addPassiveTouchListeners() {
    const canvas = document.querySelector('canvas');
    if (canvas) {
        // Remove existing listeners
        canvas.ontouchstart = null;
        canvas.ontouchmove = null;
        canvas.ontouchend = null;
        
        // Add passive listeners
        canvas.addEventListener('touchstart', handleTouch, { passive: true });
        canvas.addEventListener('touchmove', handleTouch, { passive: true });
        canvas.addEventListener('touchend', handleTouch, { passive: true });
    }
}

function handleTouch(e) {
    // Minimal touch handling
    const touch = e.touches[0] || e.changedTouches[0];
    if (touch) {
        // Process touch coordinates
        const rect = e.target.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Send to game if needed
        if (window.game && window.game.input) {
            window.game.input.processTouch(x, y, e.type);
        }
    }
}

addPassiveTouchListeners();
```

**Solution 2: Optimize CSS for Touch Performance**
```javascript
// Add CSS optimizations for better touch performance
const performanceCSS = `
    * {
        touch-action: manipulation;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
    }
    
    canvas, .game-container {
        touch-action: none;
        will-change: transform;
        transform: translateZ(0);
    }
`;

const style = document.createElement('style');
style.textContent = performanceCSS;
document.head.appendChild(style);
```

---

## Performance Issues

### Issue: Low Frame Rate on Mobile

#### Symptoms:
- Choppy animations
- Game runs slowly
- Poor visual performance

#### Diagnosis:
```javascript
// Performance monitoring
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;

function measureFPS() {
    const currentTime = performance.now();
    frameCount++;
    
    if (currentTime - lastTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;
        
        console.log(`Current FPS: ${fps}`);
        
        if (fps < 20) {
            console.warn('Low FPS detected, consider optimizations');
        }
    }
    
    requestAnimationFrame(measureFPS);
}

measureFPS();

// Memory usage check
if (performance.memory) {
    const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
    console.log(`Memory usage: ${memoryMB.toFixed(1)}MB`);
    
    if (memoryMB > 100) {
        console.warn('High memory usage detected');
    }
}
```

#### Solutions:

**Solution 1: Reduce Animation Quality**
```javascript
// Lower animation quality for better performance
function enableLowPerformanceMode() {
    // Reduce overlay animation duration
    if (window.overlayController) {
        window.overlayController.setAnimationDuration(100, 100);
    }
    
    // Increase orientation check debounce
    if (window.orientationManager) {
        window.orientationManager.debounceDelay = 500;
    }
    
    // Add performance CSS class
    document.body.classList.add('low-performance-mode');
    
    // Add CSS for reduced animations
    const performanceCSS = `
        .low-performance-mode * {
            animation-duration: 0.1s !important;
            transition-duration: 0.1s !important;
        }
        
        .low-performance-mode .orientation-overlay {
            backdrop-filter: none !important;
        }
    `;
    
    const style = document.createElement('style');
    style.textContent = performanceCSS;
    document.head.appendChild(style);
    
    console.log('Low performance mode enabled');
}

// Auto-enable if FPS is consistently low
if (fps < 20) {
    enableLowPerformanceMode();
}
```

**Solution 2: Memory Cleanup**
```javascript
// Force garbage collection and cleanup
function performCleanup() {
    // Clear any cached data
    if (window.deviceDetection) {
        window.deviceDetection._cache = {};
        window.deviceDetection.refresh();
    }
    
    // Clear orientation event cache
    if (window.orientationManager) {
        window.orientationManager.callbacks.onOrientationChange = [];
        window.orientationManager.callbacks.onOverlayShow = [];
        window.orientationManager.callbacks.onOverlayHide = [];
    }
    
    // Force garbage collection if available
    if (window.gc) {
        window.gc();
    }
    
    console.log('Cleanup performed');
}

// Run cleanup periodically
setInterval(performCleanup, 30000); // Every 30 seconds
```

### Issue: High Memory Usage

#### Symptoms:
- Browser becomes slow over time
- Game crashes after extended play
- Device becomes hot

#### Diagnosis:
```javascript
// Memory monitoring
function monitorMemory() {
    if (!performance.memory) {
        console.log('Performance.memory API not available');
        return;
    }
    
    const memory = performance.memory;
    const used = memory.usedJSHeapSize / 1024 / 1024;
    const total = memory.totalJSHeapSize / 1024 / 1024;
    const limit = memory.jsHeapSizeLimit / 1024 / 1024;
    
    console.log(`Memory: ${used.toFixed(1)}MB used, ${total.toFixed(1)}MB total, ${limit.toFixed(1)}MB limit`);
    
    if (used / limit > 0.8) {
        console.warn('High memory usage detected!');
        return true;
    }
    
    return false;
}

// Check memory every 10 seconds
const memoryInterval = setInterval(() => {
    if (monitorMemory()) {
        console.log('Attempting memory cleanup...');
        performCleanup();
    }
}, 10000);
```

#### Solutions:

**Solution 1: Implement Object Pooling**
```javascript
// Object pooling for frequently created objects
class MobileObjectPool {
    constructor() {
        this.orientationEventPool = [];
        this.touchEventPool = [];
    }
    
    getOrientationEvent() {
        return this.orientationEventPool.pop() || {
            oldOrientation: null,
            newOrientation: null,
            timestamp: 0
        };
    }
    
    releaseOrientationEvent(event) {
        event.oldOrientation = null;
        event.newOrientation = null;
        event.timestamp = 0;
        this.orientationEventPool.push(event);
    }
    
    cleanup() {
        this.orientationEventPool.length = Math.min(this.orientationEventPool.length, 10);
        this.touchEventPool.length = Math.min(this.touchEventPool.length, 20);
    }
}

window.mobileObjectPool = new MobileObjectPool();

// Use in OrientationManager
const originalDispatchEvent = window.orientationManager?._dispatchOrientationEvent;
if (originalDispatchEvent) {
    window.orientationManager._dispatchOrientationEvent = function(detail) {
        const event = window.mobileObjectPool.getOrientationEvent();
        event.oldOrientation = detail.oldOrientation;
        event.newOrientation = detail.newOrientation;
        event.timestamp = detail.timestamp;
        
        // Dispatch event
        const customEvent = new CustomEvent('orientationchanged', {
            detail: event,
            bubbles: true
        });
        window.dispatchEvent(customEvent);
        
        // Return to pool after use
        setTimeout(() => {
            window.mobileObjectPool.releaseOrientationEvent(event);
        }, 0);
    };
}
```

---

## Browser Compatibility Problems

### Issue: Safari iOS Specific Problems

#### Common iOS Safari Issues:
1. Viewport changes on orientation
2. Audio context limitations
3. Touch event differences
4. CSS animation inconsistencies

#### Diagnosis:
```javascript
// iOS Safari specific checks
if (window.deviceDetection?.isIOS()) {
    console.log('iOS Safari Diagnosis:', {
        isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content,
        audioContext: !!(window.AudioContext || window.webkitAudioContext),
        orientationAPI: 'orientation' in screen,
        touchForceSupport: 'ontouchforcechange' in document
    });
    
    // Check for iOS-specific issues
    let initialViewportHeight = window.innerHeight;
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            const newHeight = window.innerHeight;
            console.log(`iOS viewport change: ${initialViewportHeight} → ${newHeight}`);
        }, 500);
    });
}
```

#### Solutions:

**Solution 1: iOS Viewport Handling**
```javascript
// Handle iOS viewport changes
if (window.deviceDetection?.isIOS()) {
    let isHandlingViewportChange = false;
    
    const handleIOSViewportChange = () => {
        if (isHandlingViewportChange) return;
        isHandlingViewportChange = true;
        
        setTimeout(() => {
            // Force viewport recalculation
            window.scrollTo(0, 0);
            
            // Trigger orientation check after viewport settles
            if (window.orientationManager) {
                window.orientationManager.forceCheck();
            }
            
            // Re-measure canvas if needed
            if (window.game && window.game.canvas) {
                window.game.scale.refresh();
            }
            
            isHandlingViewportChange = false;
        }, 300);
    };
    
    window.addEventListener('orientationchange', handleIOSViewportChange);
    window.addEventListener('resize', handleIOSViewportChange);
}
```

**Solution 2: iOS Audio Context Fix**
```javascript
// Fix iOS audio context issues
if (window.deviceDetection?.isIOS()) {
    const enableIOSAudio = () => {
        if (window.AudioContext || window.webkitAudioContext) {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const buffer = context.createBuffer(1, 1, 22050);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(0);
        }
    };
    
    // Enable audio on first touch
    document.addEventListener('touchstart', enableIOSAudio, { once: true });
}
```

### Issue: Android Browser Variations

#### Common Android Issues:
1. Different WebView versions
2. Samsung Internet differences
3. Keyboard impact on viewport
4. Variable performance across devices

#### Diagnosis:
```javascript
// Android browser diagnosis
if (window.deviceDetection?.isAndroid()) {
    const userAgent = navigator.userAgent;
    console.log('Android Browser Diagnosis:', {
        chrome: userAgent.includes('Chrome'),
        samsungInternet: userAgent.includes('SamsungBrowser'),
        webView: userAgent.includes('wv'),
        version: userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown',
        keyboardDetection: 'possible' // Will be detected dynamically
    });
    
    // Monitor for keyboard impact
    let initialHeight = window.innerHeight;
    window.addEventListener('resize', () => {
        const currentHeight = window.innerHeight;
        const heightDifference = initialHeight - currentHeight;
        
        if (heightDifference > 150) {
            console.log('Android keyboard likely open');
            // Don't trigger orientation changes during keyboard use
            return;
        }
        
        // Normal resize handling
        if (window.orientationManager) {
            window.orientationManager._handleOrientationChange();
        }
    });
}
```

#### Solutions:

**Solution 1: Android Keyboard Handling**
```javascript
// Handle Android keyboard impact
if (window.deviceDetection?.isAndroid()) {
    let originalHeight = window.innerHeight;
    let keyboardOpen = false;
    
    const handleAndroidResize = () => {
        const currentHeight = window.innerHeight;
        const heightDiff = originalHeight - currentHeight;
        const wasKeyboardOpen = keyboardOpen;
        
        keyboardOpen = heightDiff > 150;
        
        if (keyboardOpen) {
            // Keyboard opened - pause orientation detection
            if (window.orientationManager) {
                window.orientationManager._pauseDetection = true;
            }
        } else if (wasKeyboardOpen) {
            // Keyboard closed - resume orientation detection
            setTimeout(() => {
                if (window.orientationManager) {
                    window.orientationManager._pauseDetection = false;
                    window.orientationManager.forceCheck();
                }
            }, 300);
        }
    };
    
    window.addEventListener('resize', handleAndroidResize);
}
```

---

## Device-Specific Issues

### Issue: iPhone X and Newer (Notch Devices)

#### Symptoms:
- Content hidden behind notch
- Incorrect viewport calculations
- Touch areas blocked by notch

#### Solutions:

```javascript
// Handle iPhone notch
if (window.deviceDetection?.isIOS()) {
    // Check for notch using safe area insets
    const hasNotch = CSS.supports('padding-top: env(safe-area-inset-top)');
    
    if (hasNotch) {
        console.log('iPhone with notch detected');
        
        // Add CSS for notch handling
        const notchCSS = `
            .game-container {
                padding-left: env(safe-area-inset-left) !important;
                padding-right: env(safe-area-inset-right) !important;
            }
            
            @media (orientation: landscape) {
                .orientation-overlay {
                    padding-left: env(safe-area-inset-left);
                    padding-right: env(safe-area-inset-right);
                }
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = notchCSS;
        document.head.appendChild(style);
    }
}
```

### Issue: Samsung Galaxy Edge Screens

#### Symptoms:
- Accidental edge touches
- Touch rejection issues
- UI elements too close to edges

#### Solutions:

```javascript
// Handle Samsung Edge screens
if (navigator.userAgent.includes('SM-G')) { // Samsung Galaxy
    console.log('Samsung Galaxy device detected');
    
    // Add edge padding
    const edgeCSS = `
        .game-container {
            margin-left: 10px;
            margin-right: 10px;
        }
        
        .orientation-overlay {
            padding-left: 20px;
            padding-right: 20px;
        }
        
        button, [role="button"] {
            margin: 8px !important;
        }
    `;
    
    const style = document.createElement('style');
    style.textContent = edgeCSS;
    document.head.appendChild(style);
}
```

---

## Network and Connectivity Issues

### Issue: Poor Network Performance

#### Symptoms:
- Slow loading times
- Orientation detection delayed
- Game state synchronization issues

#### Diagnosis:
```javascript
// Network diagnostics
console.log('Network Diagnosis:', {
    online: navigator.onLine,
    connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink + ' Mbps',
        rtt: navigator.connection.rtt + 'ms',
        saveData: navigator.connection.saveData
    } : 'Connection API not supported'
});

// Test network speed
async function testNetworkSpeed() {
    const startTime = performance.now();
    try {
        await fetch('/api/health', { method: 'HEAD' });
        const endTime = performance.now();
        const latency = endTime - startTime;
        console.log(`Network latency: ${latency.toFixed(1)}ms`);
        return latency;
    } catch (error) {
        console.error('Network test failed:', error);
        return null;
    }
}

testNetworkSpeed();
```

#### Solutions:

**Solution 1: Optimize for Slow Networks**
```javascript
// Adjust for slow network conditions
if (navigator.connection && navigator.connection.effectiveType === 'slow-2g') {
    console.log('Slow network detected, optimizing...');
    
    // Reduce animation quality
    enableLowPerformanceMode();
    
    // Increase debounce delays
    if (window.orientationManager) {
        window.orientationManager.debounceDelay = 1000;
    }
    
    // Disable non-essential features
    if (window.overlayController) {
        window.overlayController.configure({
            animations: {
                fadeIn: { duration: 100 },
                fadeOut: { duration: 100 }
            }
        });
    }
}
```

---

## Advanced Debugging

### Debug Mode Activation

```javascript
// Enable comprehensive debug mode
function enableMobileDebugMode() {
    // Add debug overlay
    const debugPanel = document.createElement('div');
    debugPanel.id = 'mobile-debug-panel';
    debugPanel.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 11px;
        max-width: 300px;
        max-height: 200px;
        overflow-y: auto;
        z-index: 10002;
    `;
    
    document.body.appendChild(debugPanel);
    
    // Update debug info
    const updateDebugInfo = () => {
        const info = [];
        
        // Device info
        if (window.deviceDetection) {
            const device = window.deviceDetection.getDeviceInfo();
            info.push(`Device: ${device.isMobile ? 'Mobile' : 'Desktop'}`);
            info.push(`OS: ${device.isIOS ? 'iOS' : device.isAndroid ? 'Android' : 'Other'}`);
            info.push(`Orientation: ${device.orientation}`);
            info.push(`Screen: ${device.screenWidth}x${device.screenHeight}`);
        }
        
        // Performance info
        if (performance.memory) {
            const mem = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            info.push(`Memory: ${mem}MB`);
        }
        
        // Orientation manager state
        if (window.orientationManager) {
            const state = window.orientationManager.getState();
            info.push(`Game Paused: ${state.gamePaused}`);
            info.push(`Overlay Visible: ${state.overlayVisible}`);
        }
        
        // Network info
        if (navigator.connection) {
            info.push(`Network: ${navigator.connection.effectiveType}`);
        }
        
        debugPanel.innerHTML = info.join('<br>');
    };
    
    updateDebugInfo();
    setInterval(updateDebugInfo, 1000);
    
    // Add debug controls
    const controls = document.createElement('div');
    controls.innerHTML = `
        <button onclick="window.orientationManager?.forceCheck()">Force Check</button>
        <button onclick="window.overlayController?.toggle()">Toggle Overlay</button>
        <button onclick="performCleanup()">Cleanup</button>
    `;
    debugPanel.appendChild(controls);
    
    console.log('Mobile debug mode enabled');
}

// Enable debug mode (call this in console)
// enableMobileDebugMode();
```

### Error Logging and Reporting

```javascript
// Comprehensive error logging
class MobileErrorLogger {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        
        // Capture unhandled errors
        window.addEventListener('error', (e) => this.logError('JavaScript Error', e));
        window.addEventListener('unhandledrejection', (e) => this.logError('Promise Rejection', e));
        
        // Capture mobile-specific errors
        this.setupMobileErrorCapture();
    }
    
    logError(type, error, context = {}) {
        const errorInfo = {
            type,
            message: error.message || error.reason?.message || 'Unknown error',
            stack: error.stack || error.reason?.stack || 'No stack trace',
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            deviceInfo: window.deviceDetection?.getDeviceInfo() || {},
            context
        };
        
        this.errors.push(errorInfo);
        
        // Keep only recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(-this.maxErrors);
        }
        
        console.error('Mobile Error Logged:', errorInfo);
        
        // Send to server if available
        this.reportError(errorInfo);
    }
    
    setupMobileErrorCapture() {
        // Wrap mobile service methods to catch errors
        const services = [
            'orientationManager',
            'overlayController',
            'deviceDetection'
        ];
        
        services.forEach(serviceName => {
            const service = window[serviceName];
            if (service) {
                Object.getOwnPropertyNames(service.constructor.prototype)
                    .filter(name => typeof service[name] === 'function')
                    .forEach(methodName => {
                        const originalMethod = service[methodName];
                        service[methodName] = (...args) => {
                            try {
                                return originalMethod.apply(service, args);
                            } catch (error) {
                                this.logError(`${serviceName}.${methodName}`, error, { args });
                                throw error;
                            }
                        };
                    });
            }
        });
    }
    
    async reportError(errorInfo) {
        try {
            if (window.networkService) {
                await window.networkService.post('/api/mobile-error', errorInfo);
            }
        } catch (reportingError) {
            console.warn('Failed to report error:', reportingError);
        }
    }
    
    getErrorReport() {
        return {
            errors: this.errors,
            deviceInfo: window.deviceDetection?.getDeviceInfo() || {},
            timestamp: new Date().toISOString()
        };
    }
    
    clearErrors() {
        this.errors = [];
    }
}

// Initialize error logger
window.mobileErrorLogger = new MobileErrorLogger();
```

---

## Preventive Measures

### Pre-deployment Checklist

```javascript
// Pre-deployment mobile verification
async function runPreDeploymentCheck() {
    console.log('🚀 Running Pre-deployment Mobile Check...');
    
    const checks = [
        {
            name: 'Device Detection Service',
            test: () => {
                if (!window.deviceDetection) throw new Error('DeviceDetectionService not loaded');
                window.deviceDetection.debug();
                return true;
            }
        },
        {
            name: 'Orientation Manager',
            test: () => {
                if (!window.orientationManager) throw new Error('OrientationManager not loaded');
                const state = window.orientationManager.getState();
                if (!state.gameInitialized) throw new Error('OrientationManager not initialized');
                return true;
            }
        },
        {
            name: 'Overlay Controller',
            test: () => {
                if (!window.overlayController) throw new Error('OverlayController not loaded');
                const overlay = document.getElementById('orientation-overlay');
                if (!overlay) throw new Error('Orientation overlay element missing');
                return true;
            }
        },
        {
            name: 'Mobile Test Suite',
            test: () => {
                if (!window.MobileTestSuite) throw new Error('MobileTestSuite not loaded');
                return true;
            }
        },
        {
            name: 'Touch Target Sizes',
            test: () => {
                const buttons = document.querySelectorAll('button, [role="button"]');
                let smallCount = 0;
                buttons.forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width < 44 || rect.height < 44) smallCount++;
                });
                if (smallCount > 0) throw new Error(`${smallCount} buttons below 44px minimum`);
                return true;
            }
        }
    ];
    
    const results = [];
    
    for (const check of checks) {
        try {
            const result = await check.test();
            results.push({ name: check.name, status: 'PASS', result });
            console.log(`✅ ${check.name}: PASS`);
        } catch (error) {
            results.push({ name: check.name, status: 'FAIL', error: error.message });
            console.error(`❌ ${check.name}: FAIL - ${error.message}`);
        }
    }
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const totalCount = results.length;
    
    console.log(`\n📊 Pre-deployment Check Results: ${passCount}/${totalCount} passed`);
    
    if (passCount === totalCount) {
        console.log('🎉 All mobile systems ready for deployment!');
    } else {
        console.warn('⚠️  Some mobile systems need attention before deployment');
    }
    
    return results;
}

// Run check
runPreDeploymentCheck();
```

### Monitoring Setup

```javascript
// Production monitoring setup
class MobileMonitoring {
    constructor() {
        this.metrics = {
            orientationChanges: 0,
            overlayShows: 0,
            touchEvents: 0,
            errors: 0
        };
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Monitor orientation changes
        window.addEventListener('orientationchanged', () => {
            this.metrics.orientationChanges++;
            this.checkForAnomalies();
        });
        
        // Monitor overlay usage
        if (window.overlayController) {
            window.overlayController.onOverlayShow(() => {
                this.metrics.overlayShows++;
            });
        }
        
        // Monitor touch events
        let touchCount = 0;
        document.addEventListener('touchstart', () => {
            touchCount++;
            if (touchCount % 100 === 0) { // Report every 100 touches
                this.metrics.touchEvents = touchCount;
            }
        });
        
        // Monitor errors
        window.addEventListener('error', () => {
            this.metrics.errors++;
        });
        
        // Report metrics periodically
        setInterval(() => this.reportMetrics(), 300000); // Every 5 minutes
    }
    
    checkForAnomalies() {
        // Check for excessive orientation changes
        if (this.metrics.orientationChanges > 50) {
            console.warn('Excessive orientation changes detected');
            this.reportAnomaly('excessive_orientation_changes', this.metrics.orientationChanges);
        }
    }
    
    async reportMetrics() {
        try {
            if (window.networkService) {
                await window.networkService.post('/api/mobile-metrics', {
                    metrics: this.metrics,
                    timestamp: new Date().toISOString(),
                    deviceInfo: window.deviceDetection?.getDeviceInfo()
                });
            }
        } catch (error) {
            console.warn('Failed to report mobile metrics:', error);
        }
    }
    
    async reportAnomaly(type, data) {
        try {
            if (window.networkService) {
                await window.networkService.post('/api/mobile-anomaly', {
                    type,
                    data,
                    timestamp: new Date().toISOString(),
                    deviceInfo: window.deviceDetection?.getDeviceInfo()
                });
            }
        } catch (error) {
            console.warn('Failed to report mobile anomaly:', error);
        }
    }
}

// Initialize monitoring in production
if (window.location.hostname !== 'localhost') {
    window.mobileMonitoring = new MobileMonitoring();
}
```

---

## Support and Escalation

### Support Information Collection

When contacting support or escalating mobile issues, collect this information:

```javascript
// Generate support information package
function generateSupportInfo() {
    const supportInfo = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        
        // Device Information
        device: window.deviceDetection?.getDeviceInfo() || 'Not available',
        
        // Browser Information
        browser: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        },
        
        // Mobile System State
        mobileState: {
            orientationManager: window.orientationManager?.getState() || 'Not available',
            overlayController: window.overlayController?.getState() || 'Not available',
            deviceDetection: window.deviceDetection ? 'Available' : 'Not available'
        },
        
        // Performance Information
        performance: performance.memory ? {
            usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
            totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
            jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
        } : 'Not available',
        
        // Error History
        errors: window.mobileErrorLogger?.errors.slice(-10) || 'Error logger not available',
        
        // Configuration
        config: {
            mobileConfig: window.GameConfig?.MOBILE || 'Mobile config not available',
            gameConfigLoaded: !!window.GameConfig
        }
    };
    
    // Convert to JSON string for easy copying
    const supportJSON = JSON.stringify(supportInfo, null, 2);
    
    console.log('📋 Support Information Package:');
    console.log(supportJSON);
    
    // Also copy to clipboard if available
    if (navigator.clipboard) {
        navigator.clipboard.writeText(supportJSON).then(() => {
            console.log('✅ Support info copied to clipboard');
        }).catch(() => {
            console.log('❌ Failed to copy to clipboard');
        });
    }
    
    return supportInfo;
}

// Generate support info (call this before contacting support)
// generateSupportInfo();
```

### Contact Information

For mobile-specific issues that cannot be resolved using this guide:

1. **Developer Support**: Reference the [Mobile Developer Guide](MobileDeveloperGuide.md)
2. **Configuration Issues**: See [Mobile Configuration Guide](MobileConfiguration.md)
3. **Deployment Issues**: Check [Mobile Deployment Guide](MobileDeployment.md)
4. **Emergency Issues**: Generate support info and escalate with full diagnostic data

---

This troubleshooting guide provides comprehensive solutions for the most common mobile issues. Remember to always start with the quick diagnostic tools and work through the solutions systematically. Most issues can be resolved by following the step-by-step solutions provided above.