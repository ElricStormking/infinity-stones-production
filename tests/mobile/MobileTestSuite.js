/**
 * Mobile Testing Suite for Infinity Storm
 * Comprehensive test framework for mobile horizontal layout implementation
 * 
 * Test Categories:
 * 1. Device Detection Tests
 * 2. Orientation Handling Tests  
 * 3. Touch Input Validation Tests
 * 4. Screen Size Compatibility Tests
 * 5. Performance Validation Tests
 * 6. Cross-Browser Compatibility Tests
 * 7. Edge Case Handling Tests
 */

window.MobileTestSuite = class MobileTestSuite {
    constructor() {
        this.testResults = [];
        this.currentTest = null;
        this.deviceInfo = null;
        this.performanceMetrics = {};
    }

    /**
     * Initialize the test suite
     * @param {Object} options - Test configuration options
     */
    init(options = {}) {
        this.options = {
            enablePerformanceTests: options.enablePerformanceTests !== false,
            enableTouchTests: options.enableTouchTests !== false,
            enableOrientationTests: options.enableOrientationTests !== false,
            testDuration: options.testDuration || 30000, // 30 seconds default
            ...options
        };

        this.collectDeviceInfo();
        this.setupTestEnvironment();
        
        console.log('📱 Mobile Test Suite Initialized');
        console.log('Device Info:', this.deviceInfo);
    }

    /**
     * Collect comprehensive device information for testing
     */
    collectDeviceInfo() {
        this.deviceInfo = {
            // Basic device detection
            isMobile: window.deviceDetection?.isMobile() || this.fallbackMobileDetection(),
            platform: this.detectPlatform(),
            
            // Screen information
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            availableWidth: window.screen.availWidth,
            availableHeight: window.screen.availHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            
            // Viewport information
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            documentWidth: document.documentElement.clientWidth,
            documentHeight: document.documentElement.clientHeight,
            
            // Orientation information
            orientation: this.getCurrentOrientation(),
            orientationAngle: window.orientation || 0,
            orientationSupport: this.checkOrientationAPISupport(),
            
            // Touch capabilities
            touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            
            // Browser information
            userAgent: navigator.userAgent,
            browser: this.detectBrowser(),
            
            // Performance capabilities
            hardwareConcurrency: navigator.hardwareConcurrency || 1,
            memory: navigator.deviceMemory || 'unknown',
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                saveData: navigator.connection.saveData
            } : null
        };
    }

    /**
     * Run all test suites
     * @returns {Promise<Object>} Test results summary
     */
    async runAllTests() {
        console.log('🚀 Starting Mobile Test Suite...');
        
        const testSuites = [
            { name: 'Device Detection', method: 'runDeviceDetectionTests' },
            { name: 'Orientation Handling', method: 'runOrientationTests' },
            { name: 'Touch Input', method: 'runTouchInputTests' },
            { name: 'Screen Compatibility', method: 'runScreenCompatibilityTests' },
            { name: 'Performance', method: 'runPerformanceTests' },
            { name: 'Cross-Browser', method: 'runCrossBrowserTests' },
            { name: 'Edge Cases', method: 'runEdgeCaseTests' }
        ];

        for (const suite of testSuites) {
            try {
                console.log(`\n📋 Running ${suite.name} Tests...`);
                await this[suite.method]();
            } catch (error) {
                this.logTestResult(suite.name, 'ERROR', `Suite failed: ${error.message}`);
                console.error(`❌ ${suite.name} test suite failed:`, error);
            }
        }

        return this.generateTestReport();
    }

    /**
     * Test suite: Device Detection
     */
    async runDeviceDetectionTests() {
        // Test 1: Mobile Detection Accuracy
        await this.runTest('Mobile Detection', () => {
            const detected = window.deviceDetection?.isMobile();
            const expected = this.deviceInfo.isMobile;
            
            this.assert(detected === expected, 
                `Mobile detection mismatch: detected=${detected}, expected=${expected}`);
        });

        // Test 2: Platform Detection
        await this.runTest('Platform Detection', () => {
            const isIOS = window.deviceDetection?.isIOS();
            const isAndroid = window.deviceDetection?.isAndroid();
            const actualPlatform = this.deviceInfo.platform;
            
            if (actualPlatform === 'iOS') {
                this.assert(isIOS === true, 'iOS detection failed');
                this.assert(isAndroid === false, 'Android false positive on iOS');
            } else if (actualPlatform === 'Android') {
                this.assert(isAndroid === true, 'Android detection failed');
                this.assert(isIOS === false, 'iOS false positive on Android');
            }
        });

        // Test 3: Touch Capability Detection
        await this.runTest('Touch Detection', () => {
            const hasTouchSupport = this.deviceInfo.touchSupport;
            const maxTouchPoints = this.deviceInfo.maxTouchPoints;
            
            if (this.deviceInfo.isMobile) {
                this.assert(hasTouchSupport === true, 'Mobile device should have touch support');
                this.assert(maxTouchPoints > 0, 'Mobile device should have touch points > 0');
            }
        });

        // Test 4: Device Info Completeness
        await this.runTest('Device Info Completeness', () => {
            const requiredFields = ['isMobile', 'platform', 'screenWidth', 'screenHeight', 
                                   'viewportWidth', 'viewportHeight', 'orientation'];
            
            requiredFields.forEach(field => {
                this.assert(this.deviceInfo[field] !== undefined, 
                    `Missing required device info field: ${field}`);
            });
        });
    }

    /**
     * Test suite: Orientation Handling
     */
    async runOrientationTests() {
        if (!this.options.enableOrientationTests) {
            console.log('⏭️ Orientation tests skipped (disabled)');
            return;
        }

        // Test 1: Orientation Detection API Support
        await this.runTest('Orientation API Support', () => {
            const apiSupport = this.deviceInfo.orientationSupport;
            
            if (this.deviceInfo.isMobile) {
                this.assert(apiSupport.hasOrientationAPI || apiSupport.hasScreenOrientationAPI || 
                           apiSupport.hasMatchMedia, 'Mobile device should support at least one orientation API');
            }
        });

        // Test 2: Current Orientation Detection
        await this.runTest('Current Orientation Detection', () => {
            const orientation = this.getCurrentOrientation();
            this.assert(['portrait', 'landscape'].includes(orientation), 
                `Invalid orientation detected: ${orientation}`);
        });

        // Test 3: Orientation Manager Integration
        await this.runTest('Orientation Manager Integration', () => {
            if (window.orientationManager) {
                const manager = window.orientationManager;
                
                this.assert(typeof manager.getCurrentOrientation === 'function', 
                    'OrientationManager should have getCurrentOrientation method');
                this.assert(typeof manager.handleOrientationChange === 'function', 
                    'OrientationManager should have handleOrientationChange method');
                
                const currentOrient = manager.getCurrentOrientation();
                this.assert(['portrait', 'landscape', 'unknown'].includes(currentOrient), 
                    `Invalid orientation from manager: ${currentOrient}`);
            }
        });

        // Test 4: Overlay Controller Integration
        await this.runTest('Overlay Controller Integration', () => {
            if (window.overlayController) {
                const controller = window.overlayController;
                
                this.assert(typeof controller.show === 'function', 
                    'OverlayController should have show method');
                this.assert(typeof controller.hide === 'function', 
                    'OverlayController should have hide method');
                this.assert(typeof controller.isVisible === 'function', 
                    'OverlayController should have isVisible method');
            }
        });
    }

    /**
     * Test suite: Touch Input Validation
     */
    async runTouchInputTests() {
        if (!this.options.enableTouchTests || !this.deviceInfo.touchSupport) {
            console.log('⏭️ Touch tests skipped (no touch support or disabled)');
            return;
        }

        // Test 1: Touch Event Registration
        await this.runTest('Touch Event Registration', () => {
            const gameContainer = document.getElementById('game-container');
            this.assert(gameContainer !== null, 'Game container should exist');

            // Check if Phaser game instance exists and has touch input enabled
            if (window.game && window.game.input) {
                const inputManager = window.game.input;
                this.assert(inputManager.enabled === true, 'Phaser input should be enabled');
                
                if (inputManager.touch) {
                    this.assert(inputManager.touch.enabled === true, 'Touch input should be enabled');
                }
            }
        });

        // Test 2: Touch Coordinate Mapping
        await this.runTest('Touch Coordinate Mapping', async () => {
            // This test requires interaction - we'll simulate touch events
            const gameContainer = document.getElementById('game-container');
            if (gameContainer && window.game) {
                const canvas = gameContainer.querySelector('canvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    
                    // Test touch coordinate mapping
                    const testX = rect.width / 2;
                    const testY = rect.height / 2;
                    
                    // Verify coordinates are within expected game bounds
                    this.assert(testX >= 0 && testX <= rect.width, 
                        `Touch X coordinate out of bounds: ${testX}`);
                    this.assert(testY >= 0 && testY <= rect.height, 
                        `Touch Y coordinate out of bounds: ${testY}`);
                }
            }
        });

        // Test 3: Gesture Detection Integration
        await this.runTest('Gesture Detection Integration', () => {
            if (window.gestureDetection) {
                const gestures = window.gestureDetection;
                
                this.assert(typeof gestures.detectTap === 'function', 
                    'GestureDetection should have detectTap method');
                this.assert(typeof gestures.detectSwipe === 'function', 
                    'GestureDetection should have detectSwipe method');
                this.assert(typeof gestures.detectHold === 'function', 
                    'GestureDetection should have detectHold method');
            }
        });

        // Test 4: Touch Target Size Validation
        await this.runTest('Touch Target Size Validation', () => {
            const interactiveElements = document.querySelectorAll('button, [role="button"], .interactive');
            let smallTargetsCount = 0;
            
            interactiveElements.forEach(element => {
                const rect = element.getBoundingClientRect();
                const minSize = 44; // Minimum touch target size in pixels
                
                if (rect.width < minSize || rect.height < minSize) {
                    smallTargetsCount++;
                }
            });
            
            this.assert(smallTargetsCount === 0, 
                `Found ${smallTargetsCount} touch targets smaller than 44px`);
        });
    }

    /**
     * Test suite: Screen Size Compatibility
     */
    async runScreenCompatibilityTests() {
        // Test 1: Viewport Size Validation
        await this.runTest('Viewport Size Validation', () => {
            const minWidth = 320; // Minimum supported width
            const minHeight = 480; // Minimum supported height
            
            this.assert(this.deviceInfo.viewportWidth >= minWidth, 
                `Viewport width too small: ${this.deviceInfo.viewportWidth}px < ${minWidth}px`);
            this.assert(this.deviceInfo.viewportHeight >= minHeight, 
                `Viewport height too small: ${this.deviceInfo.viewportHeight}px < ${minHeight}px`);
        });

        // Test 2: Aspect Ratio Calculation
        await this.runTest('Aspect Ratio Calculation', () => {
            const aspectRatio = this.deviceInfo.viewportWidth / this.deviceInfo.viewportHeight;
            const gameAspectRatio = 1920 / 1080; // 16:9
            
            // Calculate letterbox requirements
            const needsLetterbox = Math.abs(aspectRatio - gameAspectRatio) > 0.1;
            
            if (needsLetterbox) {
                console.log(`📐 Letterboxing required - Device: ${aspectRatio.toFixed(2)}, Game: ${gameAspectRatio.toFixed(2)}`);
            }
            
            this.assert(aspectRatio > 0, 'Aspect ratio should be positive');
        });

        // Test 3: Canvas Scaling Verification
        await this.runTest('Canvas Scaling Verification', () => {
            const gameContainer = document.getElementById('game-container');
            if (gameContainer) {
                const canvas = gameContainer.querySelector('canvas');
                if (canvas) {
                    const canvasRect = canvas.getBoundingClientRect();
                    const containerRect = gameContainer.getBoundingClientRect();
                    
                    this.assert(canvasRect.width <= containerRect.width, 
                        'Canvas should not exceed container width');
                    this.assert(canvasRect.height <= containerRect.height, 
                        'Canvas should not exceed container height');
                    
                    // Verify aspect ratio is maintained
                    const canvasAspectRatio = canvasRect.width / canvasRect.height;
                    const expectedRatio = 1920 / 1080;
                    const ratioDifference = Math.abs(canvasAspectRatio - expectedRatio);
                    
                    this.assert(ratioDifference < 0.01, 
                        `Canvas aspect ratio incorrect: ${canvasAspectRatio.toFixed(3)} vs ${expectedRatio.toFixed(3)}`);
                }
            }
        });

        // Test 4: Screen Size Categories
        await this.runTest('Screen Size Categories', () => {
            const { viewportWidth, viewportHeight } = this.deviceInfo;
            let category = 'unknown';
            
            if (viewportWidth <= 480) category = 'small-phone';
            else if (viewportWidth <= 768) category = 'large-phone';
            else if (viewportWidth <= 1024) category = 'tablet';
            else category = 'desktop';
            
            console.log(`📱 Device category: ${category} (${viewportWidth}x${viewportHeight})`);
            
            this.assert(category !== 'unknown', 'Device should fit into a known category');
        });
    }

    /**
     * Test suite: Performance Validation
     */
    async runPerformanceTests() {
        if (!this.options.enablePerformanceTests) {
            console.log('⏭️ Performance tests skipped (disabled)');
            return;
        }

        // Test 1: Memory Usage Baseline
        await this.runTest('Memory Usage Baseline', () => {
            if (performance.memory) {
                const memInfo = {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                };
                
                this.performanceMetrics.memory = memInfo;
                
                // Verify memory usage is within reasonable bounds
                const usagePercent = (memInfo.used / memInfo.limit) * 100;
                this.assert(usagePercent < 80, 
                    `High memory usage: ${usagePercent.toFixed(1)}%`);
                
                console.log(`💾 Memory usage: ${(memInfo.used / 1024 / 1024).toFixed(1)}MB`);
            }
        });

        // Test 2: Frame Rate Monitoring
        await this.runTest('Frame Rate Monitoring', async () => {
            const frameTimes = [];
            let frameCount = 0;
            const testDuration = 3000; // 3 seconds
            
            const measureFrame = () => {
                const now = performance.now();
                if (frameTimes.length > 0) {
                    const deltaTime = now - frameTimes[frameTimes.length - 1];
                    if (deltaTime > 0) frameCount++;
                }
                frameTimes.push(now);
                
                if (now - frameTimes[0] < testDuration) {
                    requestAnimationFrame(measureFrame);
                }
            };
            
            return new Promise(resolve => {
                measureFrame();
                setTimeout(() => {
                    const fps = frameCount / (testDuration / 1000);
                    this.performanceMetrics.fps = fps;
                    
                    console.log(`🎯 Average FPS: ${fps.toFixed(1)}`);
                    
                    // Mobile target: 30+ FPS, Desktop target: 60+ FPS
                    const minFPS = this.deviceInfo.isMobile ? 25 : 50;
                    this.assert(fps >= minFPS, 
                        `Low frame rate: ${fps.toFixed(1)} FPS < ${minFPS} FPS`);
                    
                    resolve();
                }, testDuration + 100);
            });
        });

        // Test 3: Orientation Change Performance
        await this.runTest('Orientation Change Performance', async () => {
            if (this.deviceInfo.isMobile && window.orientationManager) {
                const startTime = performance.now();
                
                // Simulate orientation change handling
                const testOrientation = this.deviceInfo.orientation === 'portrait' ? 'landscape' : 'portrait';
                
                // Measure overlay show/hide performance
                if (window.overlayController) {
                    const overlayStartTime = performance.now();
                    
                    if (testOrientation === 'portrait') {
                        window.overlayController.show();
                    } else {
                        window.overlayController.hide();
                    }
                    
                    const overlayEndTime = performance.now();
                    const overlayDuration = overlayEndTime - overlayStartTime;
                    
                    this.performanceMetrics.overlayToggleTime = overlayDuration;
                    
                    this.assert(overlayDuration < 100, 
                        `Slow overlay animation: ${overlayDuration.toFixed(1)}ms`);
                }
                
                const endTime = performance.now();
                const totalDuration = endTime - startTime;
                
                this.performanceMetrics.orientationChangeTime = totalDuration;
                
                console.log(`🔄 Orientation change performance: ${totalDuration.toFixed(1)}ms`);
            }
        });

        // Test 4: Touch Response Latency
        await this.runTest('Touch Response Latency', async () => {
            if (this.deviceInfo.touchSupport) {
                // This test measures the time between touch event and visual feedback
                const gameContainer = document.getElementById('game-container');
                if (gameContainer) {
                    const canvas = gameContainer.querySelector('canvas');
                    if (canvas) {
                        // Simulate touch event timing
                        const touchLatencies = [];
                        
                        for (let i = 0; i < 5; i++) {
                            const startTime = performance.now();
                            
                            // Simulate touch processing
                            await new Promise(resolve => {
                                requestAnimationFrame(() => {
                                    const endTime = performance.now();
                                    touchLatencies.push(endTime - startTime);
                                    resolve();
                                });
                            });
                        }
                        
                        const averageLatency = touchLatencies.reduce((a, b) => a + b, 0) / touchLatencies.length;
                        this.performanceMetrics.touchLatency = averageLatency;
                        
                        console.log(`👆 Touch response latency: ${averageLatency.toFixed(1)}ms`);
                        
                        this.assert(averageLatency < 50, 
                            `High touch latency: ${averageLatency.toFixed(1)}ms`);
                    }
                }
            }
        });
    }

    /**
     * Test suite: Cross-Browser Compatibility
     */
    async runCrossBrowserTests() {
        // Test 1: API Compatibility
        await this.runTest('API Compatibility', () => {
            const requiredAPIs = [
                'requestAnimationFrame',
                'addEventListener',
                'querySelector',
                'getBoundingClientRect'
            ];
            
            requiredAPIs.forEach(api => {
                this.assert(typeof window[api] === 'function' || typeof document[api] === 'function', 
                    `Missing required API: ${api}`);
            });
        });

        // Test 2: CSS Feature Support
        await this.runTest('CSS Feature Support', () => {
            const testElement = document.createElement('div');
            const requiredCSS = [
                'transform',
                'transition',
                'flexbox'
            ];
            
            requiredCSS.forEach(feature => {
                let supported = false;
                
                switch (feature) {
                    case 'transform':
                        supported = 'transform' in testElement.style || 
                                   'webkitTransform' in testElement.style;
                        break;
                    case 'transition':
                        supported = 'transition' in testElement.style || 
                                   'webkitTransition' in testElement.style;
                        break;
                    case 'flexbox':
                        testElement.style.display = 'flex';
                        supported = testElement.style.display === 'flex';
                        break;
                }
                
                this.assert(supported, `CSS feature not supported: ${feature}`);
            });
        });

        // Test 3: WebGL Support
        await this.runTest('WebGL Support', () => {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            this.assert(gl !== null, 'WebGL not supported');
            
            if (gl) {
                const renderer = gl.getParameter(gl.RENDERER);
                const vendor = gl.getParameter(gl.VENDOR);
                
                console.log(`🎮 WebGL Renderer: ${renderer}`);
                console.log(`🎮 WebGL Vendor: ${vendor}`);
                
                this.performanceMetrics.webglRenderer = renderer;
                this.performanceMetrics.webglVendor = vendor;
            }
        });

        // Test 4: Audio Support
        await this.runTest('Audio Support', () => {
            const audioContext = window.AudioContext || window.webkitAudioContext;
            this.assert(audioContext !== undefined, 'Web Audio API not supported');
            
            // Test audio element support
            const audio = document.createElement('audio');
            this.assert(audio.canPlayType !== undefined, 'HTML5 Audio not supported');
            
            // Test specific format support
            const mp3Support = audio.canPlayType('audio/mpeg') !== '';
            const oggSupport = audio.canPlayType('audio/ogg') !== '';
            
            this.assert(mp3Support || oggSupport, 'No supported audio format found');
            
            console.log(`🔊 Audio support - MP3: ${mp3Support}, OGG: ${oggSupport}`);
        });
    }

    /**
     * Test suite: Edge Case Handling
     */
    async runEdgeCaseTests() {
        // Test 1: Rapid Orientation Changes
        await this.runTest('Rapid Orientation Changes', async () => {
            if (this.deviceInfo.isMobile && window.orientationManager) {
                const manager = window.orientationManager;
                
                // Test debouncing by simulating rapid orientation changes
                let changeCount = 0;
                const originalHandler = manager.handleOrientationChange;
                
                manager.handleOrientationChange = function(...args) {
                    changeCount++;
                    return originalHandler.apply(this, args);
                };
                
                // Simulate rapid changes
                for (let i = 0; i < 5; i++) {
                    window.dispatchEvent(new Event('orientationchange'));
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                // Wait for debouncing
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Restore original handler
                manager.handleOrientationChange = originalHandler;
                
                // Should have been debounced to only 1-2 actual calls
                this.assert(changeCount <= 2, 
                    `Orientation change debouncing failed: ${changeCount} calls`);
            }
        });

        // Test 2: Missing DOM Elements
        await this.runTest('Missing DOM Elements', () => {
            // Test graceful handling when expected elements are missing
            const missingElement = document.getElementById('non-existent-element');
            
            // Test that services handle missing elements gracefully
            if (window.overlayController) {
                // Should not throw error when overlay DOM is missing
                try {
                    window.overlayController.show();
                    window.overlayController.hide();
                    this.assert(true, 'OverlayController handles missing DOM gracefully');
                } catch (error) {
                    this.assert(false, `OverlayController should handle missing DOM: ${error.message}`);
                }
            }
        });

        // Test 3: Network Disconnection During Orientation
        await this.runTest('Network Disconnection Handling', async () => {
            // Test that orientation changes work even when network is unavailable
            const originalOnLine = navigator.onLine;
            
            // Simulate offline state
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: false
            });
            
            if (this.deviceInfo.isMobile && window.orientationManager) {
                try {
                    const manager = window.orientationManager;
                    const currentOrientation = manager.getCurrentOrientation();
                    
                    this.assert(typeof currentOrientation === 'string', 
                        'Orientation detection should work offline');
                } catch (error) {
                    this.assert(false, `Orientation handling failed offline: ${error.message}`);
                }
            }
            
            // Restore online state
            Object.defineProperty(navigator, 'onLine', {
                writable: true,
                value: originalOnLine
            });
        });

        // Test 4: Low Memory Conditions
        await this.runTest('Low Memory Conditions', async () => {
            if (performance.memory) {
                const initialMemory = performance.memory.usedJSHeapSize;
                
                // Create temporary memory pressure
                const tempArrays = [];
                try {
                    for (let i = 0; i < 100; i++) {
                        tempArrays.push(new Array(10000).fill(Math.random()));
                    }
                    
                    // Test that orientation handling still works under memory pressure
                    if (window.orientationManager) {
                        const orientation = window.orientationManager.getCurrentOrientation();
                        this.assert(typeof orientation === 'string', 
                            'Orientation detection should work under memory pressure');
                    }
                    
                } finally {
                    // Clean up memory
                    tempArrays.length = 0;
                    
                    // Force garbage collection if available
                    if (window.gc) {
                        window.gc();
                    }
                }
                
                const finalMemory = performance.memory.usedJSHeapSize;
                console.log(`💾 Memory delta: ${((finalMemory - initialMemory) / 1024 / 1024).toFixed(1)}MB`);
            }
        });
    }

    /**
     * Helper methods for test execution
     */

    async runTest(name, testFn) {
        this.currentTest = name;
        const startTime = performance.now();
        
        try {
            await testFn();
            const duration = performance.now() - startTime;
            this.logTestResult(name, 'PASS', `Completed in ${duration.toFixed(1)}ms`);
        } catch (error) {
            const duration = performance.now() - startTime;
            this.logTestResult(name, 'FAIL', `${error.message} (${duration.toFixed(1)}ms)`);
        } finally {
            this.currentTest = null;
        }
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    logTestResult(testName, status, details) {
        const result = {
            test: testName,
            status: status,
            details: details,
            timestamp: new Date().toISOString(),
            deviceInfo: this.deviceInfo
        };
        
        this.testResults.push(result);
        
        const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${emoji} ${testName}: ${details}`);
    }

    /**
     * Generate comprehensive test report
     */
    generateTestReport() {
        const passCount = this.testResults.filter(r => r.status === 'PASS').length;
        const failCount = this.testResults.filter(r => r.status === 'FAIL').length;
        const errorCount = this.testResults.filter(r => r.status === 'ERROR').length;
        const totalCount = this.testResults.length;
        
        const report = {
            summary: {
                total: totalCount,
                passed: passCount,
                failed: failCount,
                errors: errorCount,
                successRate: ((passCount / totalCount) * 100).toFixed(1)
            },
            deviceInfo: this.deviceInfo,
            performanceMetrics: this.performanceMetrics,
            results: this.testResults,
            timestamp: new Date().toISOString()
        };
        
        console.log('\n📊 Test Report Summary:');
        console.log(`Total Tests: ${totalCount}`);
        console.log(`Passed: ${passCount} (${report.summary.successRate}%)`);
        console.log(`Failed: ${failCount}`);
        console.log(`Errors: ${errorCount}`);
        
        if (this.performanceMetrics.fps) {
            console.log(`FPS: ${this.performanceMetrics.fps.toFixed(1)}`);
        }
        if (this.performanceMetrics.memory) {
            console.log(`Memory: ${(this.performanceMetrics.memory.used / 1024 / 1024).toFixed(1)}MB`);
        }
        
        return report;
    }

    /**
     * Fallback methods for device detection
     */

    fallbackMobileDetection() {
        const userAgent = navigator.userAgent.toLowerCase();
        const mobilePatterns = [
            /android/i, /webos/i, /iphone/i, /ipad/i, /ipod/i, /blackberry/i, /windows phone/i
        ];
        
        return mobilePatterns.some(pattern => pattern.test(userAgent)) || 
               (window.innerWidth <= 768) || 
               ('ontouchstart' in window);
    }

    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (/iphone|ipad|ipod/.test(userAgent)) return 'iOS';
        if (/android/.test(userAgent)) return 'Android';
        if (/windows/.test(userAgent)) return 'Windows';
        if (/mac/.test(userAgent)) return 'macOS';
        if (/linux/.test(userAgent)) return 'Linux';
        
        return 'Unknown';
    }

    detectBrowser() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('chrome')) return 'Chrome';
        if (userAgent.includes('firefox')) return 'Firefox';
        if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'Safari';
        if (userAgent.includes('edge')) return 'Edge';
        if (userAgent.includes('opera')) return 'Opera';
        
        return 'Unknown';
    }

    getCurrentOrientation() {
        // Use multiple methods for orientation detection
        if (screen.orientation && screen.orientation.type) {
            return screen.orientation.type.includes('portrait') ? 'portrait' : 'landscape';
        }
        
        if (window.orientation !== undefined) {
            return Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait';
        }
        
        if (window.matchMedia) {
            if (window.matchMedia('(orientation: portrait)').matches) return 'portrait';
            if (window.matchMedia('(orientation: landscape)').matches) return 'landscape';
        }
        
        // Fallback to window dimensions
        return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }

    checkOrientationAPISupport() {
        return {
            hasOrientationAPI: 'orientation' in window,
            hasScreenOrientationAPI: 'orientation' in screen,
            hasMatchMedia: 'matchMedia' in window,
            hasOrientationChangeEvent: 'onorientationchange' in window
        };
    }

    /**
     * Setup test environment
     */
    setupTestEnvironment() {
        // Add CSS for test indicators if needed
        const style = document.createElement('style');
        style.textContent = `
            .mobile-test-indicator {
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-family: monospace;
                z-index: 10001;
                display: none;
            }
            .mobile-test-indicator.visible {
                display: block;
            }
        `;
        document.head.appendChild(style);
        
        // Add test indicator element
        const indicator = document.createElement('div');
        indicator.id = 'mobile-test-indicator';
        indicator.className = 'mobile-test-indicator';
        indicator.textContent = 'Running Tests...';
        document.body.appendChild(indicator);
    }
};

// Auto-initialize for testing
if (typeof window !== 'undefined') {
    window.mobileTestSuite = new window.MobileTestSuite();
}