# Mobile Deployment and Maintenance Guide
## Infinity Storm - Production Mobile System Management

### Overview

This guide provides comprehensive information for deploying, maintaining, and monitoring the Infinity Storm mobile horizontal layout system in production environments. It covers deployment procedures, monitoring strategies, maintenance tasks, and operational best practices.

---

## Table of Contents

1. [Pre-deployment Preparation](#pre-deployment-preparation)
2. [Deployment Procedures](#deployment-procedures)
3. [Production Configuration](#production-configuration)
4. [Monitoring and Analytics](#monitoring-and-analytics)
5. [Maintenance Tasks](#maintenance-tasks)
6. [Performance Optimization](#performance-optimization)
7. [Security Considerations](#security-considerations)
8. [Backup and Recovery](#backup-and-recovery)
9. [Scaling Considerations](#scaling-considerations)
10. [Incident Response](#incident-response)
11. [Version Management](#version-management)
12. [Quality Assurance](#quality-assurance)

---

## Pre-deployment Preparation

### Environment Setup

#### Production Environment Requirements

```bash
# Server Requirements
- Node.js >= 18.0.0
- PostgreSQL >= 13
- Redis >= 6.0
- Nginx >= 1.18 (for reverse proxy)
- Docker >= 20.10 (optional, for containerization)

# Network Requirements
- SSL/TLS certificate for HTTPS
- CDN configuration for asset delivery
- Load balancer configuration (if applicable)
- WebSocket support enabled

# Security Requirements
- WAF (Web Application Firewall) configuration
- DDoS protection
- Rate limiting policies
- Security headers configured
```

#### Mobile-Specific Infrastructure

```bash
# Mobile optimization infrastructure
- Asset compression and optimization
- Image optimization service
- Mobile analytics platform
- Performance monitoring tools
- Error tracking system
- A/B testing platform (optional)

# Browser compatibility testing
- BrowserStack or similar service
- Device testing lab access
- Automated cross-browser testing setup
```

### Pre-deployment Checklist

```javascript
// Pre-deployment verification script
const PreDeploymentMobileCheck = {
    async runAllChecks() {
        console.log('🚀 Starting Pre-deployment Mobile Verification...');
        
        const checkResults = await Promise.allSettled([
            this.checkMobileServices(),
            this.checkConfiguration(),
            this.checkAssets(),
            this.checkPerformance(),
            this.checkCompatibility(),
            this.checkSecurity(),
            this.checkMonitoring()
        ]);
        
        return this.generateReport(checkResults);
    },
    
    async checkMobileServices() {
        const checks = [
            () => window.deviceDetection !== undefined,
            () => window.orientationManager !== undefined,
            () => window.overlayController !== undefined,
            () => window.MobileTestSuite !== undefined,
            () => document.getElementById('orientation-overlay') !== null
        ];
        
        return checks.every(check => check());
    },
    
    async checkConfiguration() {
        const config = window.GameConfig?.MOBILE;
        return config && 
               config.ORIENTATION &&
               config.DEVICE_DETECTION &&
               config.TOUCH &&
               config.PERFORMANCE;
    },
    
    async checkAssets() {
        // Verify mobile-specific assets are optimized
        const assets = [
            'assets/images/orientation-icon.png',
            'assets/css/mobile.css',
            'assets/audio/mobile-feedback.mp3'
        ];
        
        const results = await Promise.allSettled(
            assets.map(asset => fetch(asset, { method: 'HEAD' }))
        );
        
        return results.every(result => result.status === 'fulfilled');
    },
    
    async checkPerformance() {
        // Run performance benchmarks
        const testSuite = new MobileTestSuite();
        testSuite.init({ enablePerformanceTests: true });
        
        const results = await testSuite.runPerformanceTests();
        return results.summary.successRate > 90;
    },
    
    async checkCompatibility() {
        // Verify browser compatibility APIs
        const apis = [
            'orientationchange' in window,
            'matchMedia' in window,
            'addEventListener' in window,
            'requestAnimationFrame' in window,
            'performance' in window
        ];
        
        return apis.every(supported => supported);
    },
    
    async checkSecurity() {
        // Security checks for mobile
        return location.protocol === 'https:' &&
               document.querySelector('meta[http-equiv="Content-Security-Policy"]') &&
               !window.location.hostname.includes('localhost');
    },
    
    async checkMonitoring() {
        // Verify monitoring systems are configured
        return window.mobileMonitoring !== undefined ||
               window.analytics !== undefined;
    }
};

// Usage before deployment
// PreDeploymentMobileCheck.runAllChecks().then(console.log);
```

### Asset Optimization

#### Mobile Asset Pipeline

```bash
#!/bin/bash
# mobile-asset-optimization.sh

echo "📱 Starting Mobile Asset Optimization..."

# Optimize images for mobile
echo "🖼️  Optimizing images..."
for img in assets/images/mobile/*.{png,jpg,jpeg}; do
    if [ -f "$img" ]; then
        # Generate WebP versions for modern browsers
        cwebp -q 80 "$img" -o "${img%.*}.webp"
        
        # Generate multiple sizes for different screen densities
        convert "$img" -resize 50% "${img%.*}@1x.${img##*.}"
        convert "$img" -resize 75% "${img%.*}@1.5x.${img##*.}"
        convert "$img" -resize 100% "${img%.*}@2x.${img##*.}"
        convert "$img" -resize 150% "${img%.*}@3x.${img##*.}"
    fi
done

# Optimize CSS for mobile
echo "🎨 Optimizing CSS..."
npx postcss assets/css/mobile.css --use autoprefixer cssnano -o assets/css/mobile.min.css

# Optimize JavaScript
echo "📄 Optimizing JavaScript..."
for js in src/managers/OrientationManager.js src/services/DeviceDetectionService.js src/controllers/OverlayController.js; do
    if [ -f "$js" ]; then
        npx terser "$js" --compress --mangle -o "${js%.*}.min.js"
    fi
done

# Generate service worker for offline support
echo "📦 Generating service worker..."
npx workbox generateSW workbox-config.js

echo "✅ Mobile asset optimization complete!"
```

#### Workbox Configuration for PWA

```javascript
// workbox-config.js
module.exports = {
    globDirectory: './',
    globPatterns: [
        'index.html',
        'assets/css/mobile.min.css',
        'assets/images/mobile/**/*.{png,jpg,jpeg,webp}',
        'src/managers/OrientationManager.min.js',
        'src/services/DeviceDetectionService.min.js',
        'src/controllers/OverlayController.min.js'
    ],
    swDest: 'sw.js',
    runtimeCaching: [
        {
            urlPattern: /^https:\/\/api\.infinitystorm\.com/,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'api-cache',
                expiration: {
                    maxAgeSeconds: 300 // 5 minutes
                }
            }
        },
        {
            urlPattern: /\.(?:png|jpg|jpeg|webp|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
                cacheName: 'images',
                expiration: {
                    maxEntries: 60,
                    maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
                }
            }
        }
    ]
};
```

---

## Deployment Procedures

### Staging Deployment

#### Staging Environment Setup

```bash
#!/bin/bash
# deploy-mobile-staging.sh

echo "🎭 Deploying to Staging Environment..."

# Set staging environment variables
export NODE_ENV=staging
export MOBILE_DEBUG_MODE=true
export MOBILE_CONSOLE_LOGGING=debug
export MOBILE_PERFORMANCE_PROFILING=true

# Deploy to staging server
echo "📤 Uploading files to staging..."
rsync -avz --exclude='node_modules' ./ staging-server:/var/www/infinity-storm-staging/

# Install dependencies
echo "📦 Installing dependencies..."
ssh staging-server "cd /var/www/infinity-storm-staging && npm install"

# Start staging services
echo "🚀 Starting staging services..."
ssh staging-server "cd /var/www/infinity-storm-staging && pm2 restart staging-infinity-storm"

# Run staging tests
echo "🧪 Running staging tests..."
ssh staging-server "cd /var/www/infinity-storm-staging && npm run test:mobile:staging"

echo "✅ Staging deployment complete!"
echo "🌐 Staging URL: https://staging.infinitystorm.com"
```

#### Staging Mobile Testing

```javascript
// staging-mobile-test.js
const StagingMobileTest = {
    async runStagingTests() {
        console.log('🎭 Running Staging Mobile Tests...');
        
        const tests = [
            this.testDeviceDetection,
            this.testOrientationHandling,
            this.testPerformanceMetrics,
            this.testErrorHandling,
            this.testAnalyticsIntegration
        ];
        
        const results = [];
        
        for (const test of tests) {
            try {
                const result = await test();
                results.push({ test: test.name, status: 'PASS', result });
            } catch (error) {
                results.push({ test: test.name, status: 'FAIL', error: error.message });
            }
        }
        
        return this.generateStagingReport(results);
    },
    
    async testDeviceDetection() {
        const testSuite = new MobileTestSuite();
        testSuite.init();
        await testSuite.runDeviceDetectionTests();
        return 'Device detection functional';
    },
    
    async testOrientationHandling() {
        // Simulate orientation changes in staging
        window.orientationManager.forceCheck();
        await new Promise(resolve => setTimeout(resolve, 500));
        return 'Orientation handling responsive';
    },
    
    async testPerformanceMetrics() {
        const perfStart = performance.now();
        window.overlayController.show();
        await new Promise(resolve => setTimeout(resolve, 300));
        window.overlayController.hide();
        const perfEnd = performance.now();
        
        if (perfEnd - perfStart > 1000) {
            throw new Error('Performance below threshold');
        }
        return 'Performance within acceptable limits';
    },
    
    async testErrorHandling() {
        const originalConsoleError = console.error;
        let errorCaught = false;
        
        console.error = () => { errorCaught = true; };
        
        try {
            // Trigger intentional error
            window.orientationManager._processOrientationChange();
        } catch (e) {
            // Expected
        }
        
        console.error = originalConsoleError;
        
        return errorCaught ? 'Error handling working' : 'Error handling needs review';
    },
    
    async testAnalyticsIntegration() {
        if (window.mobileMonitoring) {
            window.mobileMonitoring.reportMetrics();
            return 'Analytics integration active';
        }
        throw new Error('Analytics not configured');
    }
};
```

### Production Deployment

#### Production Deployment Script

```bash
#!/bin/bash
# deploy-mobile-production.sh

set -e  # Exit on any error

echo "🚀 Starting Production Mobile Deployment..."

# Verify staging tests passed
if [ "$STAGING_TESTS_PASSED" != "true" ]; then
    echo "❌ Staging tests must pass before production deployment"
    exit 1
fi

# Create backup of current production
echo "💾 Creating production backup..."
ssh production-server "tar -czf /backups/infinity-storm-$(date +%Y%m%d_%H%M%S).tar.gz /var/www/infinity-storm-production/"

# Deploy to production with zero-downtime
echo "📤 Deploying to production..."

# Upload to temporary directory
rsync -avz --exclude='node_modules' --exclude='.git' ./ production-server:/var/www/infinity-storm-temp/

# Install production dependencies
ssh production-server "cd /var/www/infinity-storm-temp && npm ci --production"

# Run production build
ssh production-server "cd /var/www/infinity-storm-temp && npm run build:production"

# Atomic switch to new version
ssh production-server "
    mv /var/www/infinity-storm-production /var/www/infinity-storm-old &&
    mv /var/www/infinity-storm-temp /var/www/infinity-storm-production &&
    pm2 reload production-infinity-storm --update-env
"

# Verify deployment
echo "🔍 Verifying deployment..."
sleep 10  # Allow time for services to start

# Health check
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://infinitystorm.com/api/health)
if [ "$HEALTH_STATUS" != "200" ]; then
    echo "❌ Health check failed, rolling back..."
    ssh production-server "
        pm2 stop production-infinity-storm &&
        mv /var/www/infinity-storm-production /var/www/infinity-storm-failed &&
        mv /var/www/infinity-storm-old /var/www/infinity-storm-production &&
        pm2 start production-infinity-storm
    "
    exit 1
fi

# Cleanup old version on success
ssh production-server "rm -rf /var/www/infinity-storm-old"

echo "✅ Production deployment successful!"
echo "🌐 Production URL: https://infinitystorm.com"

# Notify monitoring systems
curl -X POST https://monitoring.infinitystorm.com/api/deployment \
    -H "Content-Type: application/json" \
    -d "{\"version\": \"$(git rev-parse HEAD)\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"status\": \"success\"}"
```

#### Blue-Green Deployment

```bash
#!/bin/bash
# blue-green-mobile-deployment.sh

CURRENT_ENV=$(ssh production-server "readlink /var/www/infinity-storm-current")
NEW_ENV=""

if [[ "$CURRENT_ENV" == *"blue"* ]]; then
    NEW_ENV="green"
    OLD_ENV="blue"
else
    NEW_ENV="blue"
    OLD_ENV="green"
fi

echo "🔄 Blue-Green Deployment: $OLD_ENV -> $NEW_ENV"

# Deploy to inactive environment
rsync -avz ./ production-server:/var/www/infinity-storm-$NEW_ENV/

# Install and test in new environment
ssh production-server "
    cd /var/www/infinity-storm-$NEW_ENV &&
    npm ci --production &&
    npm run test:production &&
    pm2 start ecosystem.$NEW_ENV.config.js
"

# Verify new environment is healthy
sleep 30
NEW_ENV_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://$NEW_ENV.infinitystorm.com/api/health)

if [ "$NEW_ENV_HEALTH" == "200" ]; then
    echo "✅ New environment healthy, switching traffic..."
    
    # Switch symlink atomically
    ssh production-server "ln -sfn /var/www/infinity-storm-$NEW_ENV /var/www/infinity-storm-current"
    
    # Reload load balancer configuration
    ssh production-server "nginx -s reload"
    
    # Stop old environment after grace period
    sleep 60
    ssh production-server "pm2 stop ecosystem.$OLD_ENV.config.js"
    
    echo "✅ Blue-Green deployment complete!"
else
    echo "❌ New environment unhealthy, keeping current environment"
    ssh production-server "pm2 stop ecosystem.$NEW_ENV.config.js"
    exit 1
fi
```

---

## Production Configuration

### Environment Variables

```bash
# production.env
NODE_ENV=production

# Mobile Configuration
MOBILE_ORIENTATION_ENFORCEMENT=true
MOBILE_TOUCH_OPTIMIZATION=true
MOBILE_PERFORMANCE_MONITORING=true
MOBILE_DEBUG_MODE=false
MOBILE_CONSOLE_LOGGING=error

# Performance Settings
MOBILE_TARGET_FPS=30
MOBILE_MEMORY_LIMIT=256
MOBILE_BATTERY_OPTIMIZATION=true

# Analytics and Monitoring
MOBILE_ANALYTICS_ENABLED=true
MOBILE_ANALYTICS_ENDPOINT=https://analytics.infinitystorm.com
MOBILE_ERROR_REPORTING_ENDPOINT=https://errors.infinitystorm.com

# Security
MOBILE_CSP_ENABLED=true
MOBILE_RATE_LIMITING=true
MOBILE_WAF_ENABLED=true

# CDN and Assets
MOBILE_CDN_URL=https://cdn.infinitystorm.com
MOBILE_ASSET_VERSION=v1.2.3
MOBILE_PRELOAD_CRITICAL_ASSETS=true
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/infinity-storm-mobile
server {
    listen 443 ssl http2;
    server_name infinitystorm.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/infinitystorm.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/infinitystorm.com/privkey.pem;
    
    # Mobile-specific optimizations
    location ~* \.(png|jpg|jpeg|gif|webp|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept";
        
        # Serve WebP to supporting browsers
        location ~* \.(png|jpg|jpeg)$ {
            if ($http_accept ~* "webp") {
                rewrite ^(.+)\.(png|jpg|jpeg)$ $1.webp last;
            }
        }
    }
    
    # Mobile CSS/JS optimization
    location ~* \.(css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        gzip_static on;
        brotli_static on;
    }
    
    # Mobile API endpoints
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Mobile-specific headers
        add_header X-Mobile-Optimized "true";
    }
    
    # WebSocket support for mobile
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Security headers for mobile
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Content Security Policy for mobile
    add_header Content-Security-Policy "
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.infinitystorm.com;
        style-src 'self' 'unsafe-inline' https://cdn.infinitystorm.com;
        img-src 'self' data: https://cdn.infinitystorm.com;
        connect-src 'self' wss://infinitystorm.com https://api.infinitystorm.com;
        font-src 'self' https://cdn.infinitystorm.com;
        media-src 'self' https://cdn.infinitystorm.com;
    " always;
    
    # Mobile-specific rate limiting
    limit_req_zone $binary_remote_addr zone=mobile_api:10m rate=30r/m;
    limit_req zone=mobile_api burst=10 nodelay;
    
    # Compression for mobile
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
    
    # Root directory
    root /var/www/infinity-storm-production;
    index index.html;
    
    # SPA fallback for mobile routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Process Manager Configuration

```javascript
// ecosystem.production.config.js
module.exports = {
    apps: [{
        name: 'infinity-storm-production',
        script: 'infinity-storm-server/server.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3000,
            // Mobile environment variables
            MOBILE_OPTIMIZATION_LEVEL: 'production',
            MOBILE_MONITORING_ENABLED: true,
            MOBILE_CACHE_STRATEGY: 'aggressive'
        },
        error_file: '/var/log/infinity-storm/error.log',
        out_file: '/var/log/infinity-storm/out.log',
        log_file: '/var/log/infinity-storm/combined.log',
        time: true,
        max_memory_restart: '512M',
        node_args: '--max_old_space_size=512',
        
        // Mobile-specific monitoring
        monitoring: {
            http: true,
            https: true,
            port: 3000
        },
        
        // Auto-restart on mobile system failures
        max_restarts: 3,
        min_uptime: '10s',
        
        // Environment-specific settings
        env_production: {
            NODE_ENV: 'production',
            MOBILE_DEBUG: false,
            MOBILE_LOGGING_LEVEL: 'error'
        }
    }]
};
```

---

## Monitoring and Analytics

### Mobile Analytics Implementation

```javascript
// mobile-analytics.js
class MobileAnalytics {
    constructor(config) {
        this.config = config;
        this.sessionId = this.generateSessionId();
        this.events = [];
        this.batchSize = 10;
        this.flushInterval = 30000; // 30 seconds
        
        this.initialize();
    }
    
    initialize() {
        // Track mobile-specific events
        this.setupMobileEventTracking();
        this.setupPerformanceTracking();
        this.setupErrorTracking();
        
        // Start periodic flushing
        setInterval(() => this.flush(), this.flushInterval);
        
        // Flush on page unload
        window.addEventListener('beforeunload', () => this.flush());
    }
    
    setupMobileEventTracking() {
        // Orientation changes
        window.addEventListener('orientationchanged', (event) => {
            this.trackEvent('mobile_orientation_change', {
                from: event.detail.oldOrientation,
                to: event.detail.newOrientation,
                device: window.deviceDetection?.getDeviceInfo()
            });
        });
        
        // Overlay interactions
        if (window.overlayController) {
            window.overlayController.onOverlayShow(() => {
                this.trackEvent('mobile_overlay_show', {
                    timestamp: Date.now(),
                    device: window.deviceDetection?.getDeviceInfo()
                });
            });
            
            window.overlayController.onOverlayHide(() => {
                this.trackEvent('mobile_overlay_hide', {
                    timestamp: Date.now()
                });
            });
        }
        
        // Touch events
        let touchCount = 0;
        document.addEventListener('touchstart', () => {
            touchCount++;
            if (touchCount % 50 === 0) { // Sample every 50th touch
                this.trackEvent('mobile_touch_interaction', {
                    touchCount,
                    device: window.deviceDetection?.getDeviceInfo()
                });
            }
        });
    }
    
    setupPerformanceTracking() {
        // Track FPS
        let frameCount = 0;
        let lastTime = performance.now();
        
        const measurePerformance = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 5000) { // Every 5 seconds
                const fps = frameCount / ((currentTime - lastTime) / 1000);
                
                this.trackEvent('mobile_performance', {
                    fps: Math.round(fps),
                    memory: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : null,
                    timestamp: currentTime,
                    device: window.deviceDetection?.getDeviceInfo()
                });
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(measurePerformance);
        };
        
        measurePerformance();
    }
    
    setupErrorTracking() {
        window.addEventListener('error', (event) => {
            this.trackEvent('mobile_error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                device: window.deviceDetection?.getDeviceInfo(),
                timestamp: Date.now()
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.trackEvent('mobile_promise_rejection', {
                reason: event.reason?.message || event.reason,
                stack: event.reason?.stack,
                device: window.deviceDetection?.getDeviceInfo(),
                timestamp: Date.now()
            });
        });
    }
    
    trackEvent(eventType, data) {
        const event = {
            type: eventType,
            sessionId: this.sessionId,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            data: data
        };
        
        this.events.push(event);
        
        if (this.events.length >= this.batchSize) {
            this.flush();
        }
    }
    
    async flush() {
        if (this.events.length === 0) return;
        
        const eventsToSend = [...this.events];
        this.events = [];
        
        try {
            await fetch(this.config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.config.apiKey
                },
                body: JSON.stringify({
                    events: eventsToSend,
                    sessionId: this.sessionId,
                    timestamp: Date.now()
                })
            });
        } catch (error) {
            console.warn('Failed to send analytics:', error);
            // Re-queue events for retry
            this.events.unshift(...eventsToSend.slice(-5)); // Keep last 5 events
        }
    }
    
    generateSessionId() {
        return 'mobile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Initialize analytics in production
if (window.location.hostname !== 'localhost' && window.MOBILE_ANALYTICS_CONFIG) {
    window.mobileAnalytics = new MobileAnalytics(window.MOBILE_ANALYTICS_CONFIG);
}
```

### Server-Side Mobile Monitoring

```javascript
// infinity-storm-server/src/middleware/mobileMonitoring.js
const mobileMonitoring = {
    // Middleware to track mobile-specific metrics
    trackMobileMetrics: (req, res, next) => {
        // Detect mobile requests
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(req.get('User-Agent'));
        
        if (isMobile) {
            // Add mobile tracking
            req.isMobile = true;
            req.startTime = Date.now();
            
            // Track response time
            res.on('finish', () => {
                const duration = Date.now() - req.startTime;
                
                // Log mobile-specific metrics
                console.log(`Mobile Request: ${req.method} ${req.path} - ${duration}ms - ${res.statusCode}`);
                
                // Send to monitoring system
                mobileMonitoring.sendMetrics({
                    type: 'mobile_request',
                    method: req.method,
                    path: req.path,
                    duration,
                    statusCode: res.statusCode,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip,
                    timestamp: new Date()
                });
            });
        }
        
        next();
    },
    
    sendMetrics: async (metrics) => {
        try {
            // Send to external monitoring service
            await fetch(process.env.MONITORING_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metrics)
            });
        } catch (error) {
            console.warn('Failed to send monitoring metrics:', error);
        }
    },
    
    // Health check endpoint for mobile
    mobileHealthCheck: (req, res) => {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            mobile: {
                orientationSupported: true,
                touchSupported: true,
                performanceMonitoring: true
            },
            server: {
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                version: process.version
            }
        };
        
        res.json(health);
    }
};

module.exports = mobileMonitoring;
```

### Monitoring Dashboard Configuration

```javascript
// monitoring-dashboard-config.js
const mobileMonitoringDashboard = {
    dashboards: [
        {
            name: 'Mobile Performance',
            panels: [
                {
                    title: 'Mobile FPS Distribution',
                    type: 'histogram',
                    query: 'mobile_performance.fps',
                    timeRange: '1h'
                },
                {
                    title: 'Orientation Changes by Device',
                    type: 'pie',
                    query: 'mobile_orientation_change.device.platform',
                    timeRange: '24h'
                },
                {
                    title: 'Mobile Error Rate',
                    type: 'line',
                    query: 'rate(mobile_error[5m])',
                    timeRange: '6h'
                },
                {
                    title: 'Touch Interactions',
                    type: 'gauge',
                    query: 'sum(mobile_touch_interaction.touchCount)',
                    timeRange: '1h'
                }
            ]
        },
        {
            name: 'Device Analytics',
            panels: [
                {
                    title: 'Device Types',
                    type: 'pie',
                    query: 'mobile_session.device.isMobile',
                    timeRange: '24h'
                },
                {
                    title: 'Browser Distribution',
                    type: 'bar',
                    query: 'mobile_session.device.browser',
                    timeRange: '7d'
                },
                {
                    title: 'Screen Resolutions',
                    type: 'table',
                    query: 'mobile_session.device.screenWidth',
                    timeRange: '24h'
                }
            ]
        }
    ],
    
    alerts: [
        {
            name: 'Mobile High Error Rate',
            condition: 'rate(mobile_error[5m]) > 0.1',
            severity: 'critical',
            notification: 'slack'
        },
        {
            name: 'Mobile Low Performance',
            condition: 'avg(mobile_performance.fps) < 20',
            severity: 'warning',
            notification: 'email'
        },
        {
            name: 'Mobile Orientation Issues',
            condition: 'rate(mobile_orientation_error[10m]) > 0.05',
            severity: 'warning',
            notification: 'slack'
        }
    ]
};
```

---

## Maintenance Tasks

### Daily Maintenance

```bash
#!/bin/bash
# daily-mobile-maintenance.sh

echo "📱 Starting Daily Mobile Maintenance..."

# Check mobile system health
echo "🏥 Checking mobile system health..."
curl -sf https://infinitystorm.com/api/mobile/health || echo "⚠️  Mobile health check failed"

# Analyze mobile performance metrics
echo "📊 Analyzing mobile performance..."
node scripts/mobile-performance-report.js --period=24h

# Check for mobile-specific errors
echo "🚨 Checking mobile error logs..."
grep -i "mobile\|orientation\|touch" /var/log/infinity-storm/error.log | tail -50

# Update mobile browser compatibility data
echo "🌐 Updating browser compatibility data..."
npm run update-browser-data

# Optimize mobile assets if needed
echo "🖼️  Checking mobile asset optimization..."
node scripts/mobile-asset-check.js

# Clean up mobile analytics data older than 90 days
echo "🗑️  Cleaning old mobile analytics..."
node scripts/cleanup-mobile-analytics.js --days=90

echo "✅ Daily mobile maintenance complete!"
```

### Weekly Maintenance

```bash
#!/bin/bash
# weekly-mobile-maintenance.sh

echo "📱 Starting Weekly Mobile Maintenance..."

# Run comprehensive mobile tests
echo "🧪 Running comprehensive mobile tests..."
npm run test:mobile:comprehensive

# Generate mobile performance report
echo "📊 Generating weekly mobile performance report..."
node scripts/mobile-weekly-report.js

# Update mobile device database
echo "📱 Updating mobile device database..."
npm run update-device-database

# Check mobile SSL certificate expiration
echo "🔒 Checking SSL certificate expiration..."
openssl x509 -in /etc/letsencrypt/live/infinitystorm.com/cert.pem -dates -noout

# Backup mobile configuration
echo "💾 Backing up mobile configuration..."
tar -czf /backups/mobile-config-$(date +%Y%m%d).tar.gz src/config/GameConfig.js docs/mobile/

# Review mobile analytics insights
echo "📈 Reviewing mobile analytics..."
node scripts/mobile-analytics-insights.js --period=1week

echo "✅ Weekly mobile maintenance complete!"
```

### Monthly Maintenance

```bash
#!/bin/bash
# monthly-mobile-maintenance.sh

echo "📱 Starting Monthly Mobile Maintenance..."

# Update mobile browser support matrix
echo "🌐 Updating browser support matrix..."
node scripts/update-browser-support.js

# Review and update mobile configuration
echo "⚙️  Reviewing mobile configuration..."
node scripts/mobile-config-review.js

# Security audit for mobile components
echo "🔒 Running mobile security audit..."
npm audit --audit-level=moderate --production

# Performance regression testing
echo "🏃 Running performance regression tests..."
npm run test:mobile:performance:regression

# Update mobile documentation
echo "📚 Updating mobile documentation..."
node scripts/update-mobile-docs.js

# Review mobile user feedback
echo "💬 Reviewing mobile user feedback..."
node scripts/mobile-feedback-analysis.js --period=1month

echo "✅ Monthly mobile maintenance complete!"
```

---

## Performance Optimization

### Production Performance Monitoring

```javascript
// mobile-performance-optimizer.js
class MobilePerformanceOptimizer {
    constructor() {
        this.metrics = new Map();
        this.thresholds = {
            fps: { critical: 15, warning: 25 },
            memory: { critical: 200, warning: 150 }, // MB
            latency: { critical: 1000, warning: 500 } // ms
        };
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Monitor FPS
        let frameCount = 0;
        let lastTime = performance.now();
        
        const monitorFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 5000) {
                const fps = frameCount / ((currentTime - lastTime) / 1000);
                this.recordMetric('fps', fps);
                this.optimizeBasedOnFPS(fps);
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(monitorFPS);
        };
        
        monitorFPS();
        
        // Monitor memory
        if (performance.memory) {
            setInterval(() => {
                const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
                this.recordMetric('memory', memoryMB);
                this.optimizeBasedOnMemory(memoryMB);
            }, 10000);
        }
        
        // Monitor network latency
        this.monitorLatency();
    }
    
    recordMetric(type, value) {
        if (!this.metrics.has(type)) {
            this.metrics.set(type, []);
        }
        
        const metrics = this.metrics.get(type);
        metrics.push({ value, timestamp: Date.now() });
        
        // Keep only last 100 measurements
        if (metrics.length > 100) {
            metrics.shift();
        }
    }
    
    optimizeBasedOnFPS(fps) {
        if (fps < this.thresholds.fps.critical) {
            console.warn('Critical FPS detected, applying aggressive optimizations');
            this.applyAggressiveOptimizations();
        } else if (fps < this.thresholds.fps.warning) {
            console.log('Low FPS detected, applying basic optimizations');
            this.applyBasicOptimizations();
        }
    }
    
    optimizeBasedOnMemory(memoryMB) {
        if (memoryMB > this.thresholds.memory.critical) {
            console.warn('Critical memory usage, forcing cleanup');
            this.forceMemoryCleanup();
        } else if (memoryMB > this.thresholds.memory.warning) {
            console.log('High memory usage, performing cleanup');
            this.performMemoryCleanup();
        }
    }
    
    applyBasicOptimizations() {
        // Reduce animation quality
        if (window.overlayController) {
            window.overlayController.setAnimationDuration(150, 150);
        }
        
        // Increase debounce delays
        if (window.orientationManager) {
            window.orientationManager.debounceDelay = Math.max(
                window.orientationManager.debounceDelay,
                400
            );
        }
        
        // Add performance CSS class
        document.body.classList.add('performance-optimized');
    }
    
    applyAggressiveOptimizations() {
        this.applyBasicOptimizations();
        
        // Disable non-essential animations
        document.body.classList.add('animations-disabled');
        
        // Reduce orientation check frequency
        if (window.orientationManager) {
            window.orientationManager.debounceDelay = 1000;
        }
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }
    
    performMemoryCleanup() {
        // Clear mobile service caches
        if (window.deviceDetection) {
            window.deviceDetection._cache = {};
        }
        
        // Clear orientation event cache
        if (window.orientationManager) {
            window.orientationManager.callbacks.onOrientationChange.length = 0;
        }
    }
    
    forceMemoryCleanup() {
        this.performMemoryCleanup();
        
        // More aggressive cleanup
        if (window.mobileObjectPool) {
            window.mobileObjectPool.cleanup();
        }
        
        // Request garbage collection
        if (window.gc) {
            window.gc();
        }
    }
    
    async monitorLatency() {
        setInterval(async () => {
            const start = performance.now();
            try {
                await fetch('/api/ping', { method: 'HEAD' });
                const latency = performance.now() - start;
                this.recordMetric('latency', latency);
            } catch (error) {
                console.warn('Latency check failed:', error);
            }
        }, 30000); // Every 30 seconds
    }
    
    generateReport() {
        const report = {};
        
        for (const [type, values] of this.metrics.entries()) {
            if (values.length > 0) {
                const latest = values[values.length - 1].value;
                const average = values.reduce((sum, v) => sum + v.value, 0) / values.length;
                const min = Math.min(...values.map(v => v.value));
                const max = Math.max(...values.map(v => v.value));
                
                report[type] = { latest, average, min, max };
            }
        }
        
        return report;
    }
}

// Initialize performance optimizer in production
if (window.location.hostname !== 'localhost') {
    window.mobilePerformanceOptimizer = new MobilePerformanceOptimizer();
}
```

### Asset Optimization Pipeline

```javascript
// mobile-asset-optimizer.js
const MobileAssetOptimizer = {
    async optimizeAssets() {
        console.log('🖼️  Starting mobile asset optimization...');
        
        await this.optimizeImages();
        await this.optimizeCSS();
        await this.optimizeJavaScript();
        await this.generateWebP();
        await this.createServiceWorker();
        
        console.log('✅ Mobile asset optimization complete!');
    },
    
    async optimizeImages() {
        const images = await this.findFiles('assets/images/**/*.{png,jpg,jpeg}');
        
        for (const image of images) {
            // Generate multiple resolutions
            await this.generateImageVariants(image);
            
            // Compress original
            await this.compressImage(image);
        }
    },
    
    async generateImageVariants(imagePath) {
        const variants = [
            { suffix: '@1x', scale: 0.5 },
            { suffix: '@1.5x', scale: 0.75 },
            { suffix: '@2x', scale: 1.0 },
            { suffix: '@3x', scale: 1.5 }
        ];
        
        for (const variant of variants) {
            const outputPath = imagePath.replace(/(\.[^.]+)$/, `${variant.suffix}$1`);
            await this.resizeImage(imagePath, outputPath, variant.scale);
        }
    },
    
    async generateWebP() {
        const images = await this.findFiles('assets/images/**/*.{png,jpg,jpeg}');
        
        for (const image of images) {
            const webpPath = image.replace(/\.[^.]+$/, '.webp');
            await this.convertToWebP(image, webpPath);
        }
    },
    
    async optimizeCSS() {
        const cssFiles = await this.findFiles('assets/css/**/*.css');
        
        for (const cssFile of cssFiles) {
            // Add vendor prefixes
            await this.addVendorPrefixes(cssFile);
            
            // Minify
            const minifiedPath = cssFile.replace('.css', '.min.css');
            await this.minifyCSS(cssFile, minifiedPath);
        }
    },
    
    async optimizeJavaScript() {
        const jsFiles = await this.findFiles('src/**/*.js');
        
        for (const jsFile of jsFiles) {
            // Skip already minified files
            if (jsFile.includes('.min.js')) continue;
            
            // Minify and create source maps
            const minifiedPath = jsFile.replace('.js', '.min.js');
            await this.minifyJavaScript(jsFile, minifiedPath);
        }
    },
    
    async createServiceWorker() {
        const swConfig = {
            globDirectory: './',
            globPatterns: [
                'index.html',
                'assets/css/*.min.css',
                'assets/images/**/*.{png,jpg,jpeg,webp}',
                'src/**/*.min.js'
            ],
            swDest: 'sw.js',
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
            runtimeCaching: [
                {
                    urlPattern: /^https:\/\/api\.infinitystorm\.com/,
                    handler: 'NetworkFirst',
                    options: {
                        cacheName: 'api-cache',
                        expiration: { maxAgeSeconds: 300 }
                    }
                }
            ]
        };
        
        await workbox.generateSW(swConfig);
    }
};
```

---

## Security Considerations

### Mobile Security Checklist

```bash
#!/bin/bash
# mobile-security-audit.sh

echo "🔒 Starting Mobile Security Audit..."

# Check HTTPS enforcement
echo "🌐 Checking HTTPS enforcement..."
curl -I http://infinitystorm.com | grep -i "location.*https" || echo "⚠️  HTTPS redirect not found"

# Verify security headers
echo "🛡️  Checking security headers..."
HEADERS=$(curl -I https://infinitystorm.com)
echo "$HEADERS" | grep -i "x-frame-options" || echo "⚠️  X-Frame-Options header missing"
echo "$HEADERS" | grep -i "content-security-policy" || echo "⚠️  CSP header missing"
echo "$HEADERS" | grep -i "x-content-type-options" || echo "⚠️  X-Content-Type-Options header missing"

# Check for mobile-specific vulnerabilities
echo "📱 Checking mobile vulnerabilities..."

# Check Content Security Policy for mobile
echo "🔐 Verifying CSP for mobile..."
node scripts/check-mobile-csp.js

# Verify touch event security
echo "👆 Checking touch event security..."
node scripts/check-touch-security.js

# Check for sensitive data exposure
echo "🕵️  Checking for sensitive data exposure..."
grep -r "password\|secret\|key" src/ --exclude-dir=node_modules || echo "✅ No obvious secrets in source"

echo "✅ Mobile security audit complete!"
```

### CSP Configuration for Mobile

```javascript
// mobile-csp-config.js
const mobileCSP = {
    'default-src': [
        "'self'",
        "https://cdn.infinitystorm.com"
    ],
    'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for Phaser
        "'unsafe-eval'", // Required for some mobile optimizations
        "https://cdn.infinitystorm.com",
        "https://analytics.infinitystorm.com"
    ],
    'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for mobile dynamic styles
        "https://cdn.infinitystorm.com"
    ],
    'img-src': [
        "'self'",
        "data:", // For inline mobile icons
        "https://cdn.infinitystorm.com",
        "https://images.infinitystorm.com"
    ],
    'connect-src': [
        "'self'",
        "https://api.infinitystorm.com",
        "wss://infinitystorm.com", // WebSocket for real-time features
        "https://analytics.infinitystorm.com"
    ],
    'font-src': [
        "'self'",
        "https://cdn.infinitystorm.com"
    ],
    'media-src': [
        "'self'",
        "https://cdn.infinitystorm.com"
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': true
};

// Generate CSP header
const generateCSPHeader = () => {
    const policies = [];
    
    for (const [directive, sources] of Object.entries(mobileCSP)) {
        if (Array.isArray(sources)) {
            policies.push(`${directive} ${sources.join(' ')}`);
        } else if (sources === true) {
            policies.push(directive);
        }
    }
    
    return policies.join('; ');
};

module.exports = { mobileCSP, generateCSPHeader };
```

### Mobile Authentication Security

```javascript
// mobile-auth-security.js
const mobileAuthSecurity = {
    // Rate limiting for mobile authentication
    mobileRateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // Limit each mobile device to 10 requests per windowMs
        message: 'Too many authentication attempts from this device',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use device fingerprint for mobile rate limiting
            const deviceId = this.generateDeviceFingerprint(req);
            return `mobile_auth_${deviceId}`;
        }
    },
    
    generateDeviceFingerprint: (req) => {
        const userAgent = req.get('User-Agent') || '';
        const acceptLanguage = req.get('Accept-Language') || '';
        const acceptEncoding = req.get('Accept-Encoding') || '';
        const ip = req.ip || '';
        
        // Create unique fingerprint for mobile device
        const fingerprint = crypto
            .createHash('sha256')
            .update(`${userAgent}${acceptLanguage}${acceptEncoding}${ip}`)
            .digest('hex')
            .substring(0, 16);
        
        return fingerprint;
    },
    
    // Secure mobile session management
    mobileSessionConfig: {
        name: 'mobile_session',
        secret: process.env.MOBILE_SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'strict'
        },
        store: new RedisStore({
            client: redisClient,
            prefix: 'mobile_sess:'
        })
    },
    
    // Mobile input validation
    validateMobileInput: (req, res, next) => {
        // Validate mobile-specific headers
        const userAgent = req.get('User-Agent');
        if (userAgent && userAgent.length > 1000) {
            return res.status(400).json({ error: 'Invalid user agent' });
        }
        
        // Validate touch event data
        if (req.body && req.body.touchData) {
            const { touchData } = req.body;
            if (!Array.isArray(touchData) || touchData.length > 10) {
                return res.status(400).json({ error: 'Invalid touch data' });
            }
            
            // Validate touch coordinates
            for (const touch of touchData) {
                if (typeof touch.x !== 'number' || typeof touch.y !== 'number') {
                    return res.status(400).json({ error: 'Invalid touch coordinates' });
                }
                if (touch.x < 0 || touch.x > 4096 || touch.y < 0 || touch.y > 4096) {
                    return res.status(400).json({ error: 'Touch coordinates out of range' });
                }
            }
        }
        
        next();
    }
};

module.exports = mobileAuthSecurity;
```

---

## Backup and Recovery

### Mobile Configuration Backup

```bash
#!/bin/bash
# backup-mobile-config.sh

BACKUP_DIR="/backups/mobile-config"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="mobile-config-${DATE}.tar.gz"

echo "💾 Starting mobile configuration backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup mobile configuration files
tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" \
    src/config/GameConfig.js \
    src/managers/OrientationManager.js \
    src/services/DeviceDetectionService.js \
    src/controllers/OverlayController.js \
    docs/mobile/ \
    tests/mobile/ \
    infinity-storm-server/.env \
    /etc/nginx/sites-available/infinity-storm-mobile

# Backup mobile analytics data
echo "📊 Backing up mobile analytics data..."
pg_dump -h localhost -U postgres -d infinity_storm \
    --table=mobile_analytics \
    --table=mobile_sessions \
    --table=mobile_errors \
    > "${BACKUP_DIR}/mobile-analytics-${DATE}.sql"

# Create backup manifest
echo "📋 Creating backup manifest..."
cat > "${BACKUP_DIR}/manifest-${DATE}.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "$(git rev-parse HEAD)",
    "files": {
        "config": "${BACKUP_FILE}",
        "analytics": "mobile-analytics-${DATE}.sql"
    },
    "checksums": {
        "config": "$(md5sum "${BACKUP_DIR}/${BACKUP_FILE}" | cut -d' ' -f1)",
        "analytics": "$(md5sum "${BACKUP_DIR}/mobile-analytics-${DATE}.sql" | cut -d' ' -f1)"
    }
}
EOF

# Clean up old backups (keep last 30 days)
find "$BACKUP_DIR" -name "mobile-config-*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "mobile-analytics-*.sql" -mtime +30 -delete
find "$BACKUP_DIR" -name "manifest-*.json" -mtime +30 -delete

echo "✅ Mobile configuration backup complete: ${BACKUP_FILE}"
```

### Mobile System Recovery

```bash
#!/bin/bash
# recover-mobile-system.sh

BACKUP_DIR="/backups/mobile-config"
RESTORE_DATE=${1:-$(ls -1 "$BACKUP_DIR"/mobile-config-*.tar.gz | sort | tail -1 | grep -o '[0-9]*_[0-9]*')}

if [ -z "$RESTORE_DATE" ]; then
    echo "❌ No backup date specified and no backups found"
    exit 1
fi

BACKUP_FILE="mobile-config-${RESTORE_DATE}.tar.gz"
ANALYTICS_FILE="mobile-analytics-${RESTORE_DATE}.sql"

echo "🔄 Starting mobile system recovery from ${RESTORE_DATE}..."

# Verify backup files exist
if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo "❌ Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Create recovery point before restore
echo "💾 Creating recovery point..."
cp -r src/config/ /tmp/mobile-recovery-point-$(date +%Y%m%d_%H%M%S)/

# Stop mobile services
echo "⏹️  Stopping mobile services..."
pm2 stop production-infinity-storm

# Restore mobile configuration
echo "📁 Restoring mobile configuration..."
tar -xzf "${BACKUP_DIR}/${BACKUP_FILE}" -C /

# Restore analytics data if available
if [ -f "${BACKUP_DIR}/${ANALYTICS_FILE}" ]; then
    echo "📊 Restoring mobile analytics data..."
    psql -h localhost -U postgres -d infinity_storm < "${BACKUP_DIR}/${ANALYTICS_FILE}"
fi

# Verify configuration integrity
echo "🔍 Verifying configuration integrity..."
node scripts/verify-mobile-config.js

# Restart services
echo "🚀 Restarting mobile services..."
pm2 start production-infinity-storm

# Run health checks
echo "🏥 Running post-recovery health checks..."
sleep 10
curl -sf https://infinitystorm.com/api/mobile/health || echo "⚠️  Mobile health check failed"

# Verify mobile functionality
echo "🧪 Testing mobile functionality..."
node scripts/test-mobile-recovery.js

echo "✅ Mobile system recovery complete!"
```

---

## Scaling Considerations

### Horizontal Scaling for Mobile

```javascript
// mobile-load-balancer-config.js
const mobileLoadBalancerConfig = {
    // Mobile-specific routing
    routing: {
        // Route mobile traffic to optimized servers
        mobileServers: [
            'mobile-server-1.infinitystorm.com',
            'mobile-server-2.infinitystorm.com',
            'mobile-server-3.infinitystorm.com'
        ],
        
        // Sticky sessions for mobile users
        sessionAffinity: 'clientIP',
        
        // Mobile device detection
        routingRules: [
            {
                condition: 'header("User-Agent") matches "Mobile|Android|iPhone|iPad"',
                target: 'mobile-servers',
                weight: 100
            },
            {
                condition: 'default',
                target: 'desktop-servers',
                weight: 100
            }
        ]
    },
    
    // Health checks for mobile endpoints
    healthChecks: {
        mobile: {
            path: '/api/mobile/health',
            interval: 30,
            timeout: 5,
            healthyThreshold: 2,
            unhealthyThreshold: 3
        }
    },
    
    // Mobile traffic shaping
    trafficShaping: {
        // Limit concurrent mobile connections per server
        maxMobileConnections: 1000,
        
        // Mobile request rate limiting
        mobileRateLimit: {
            requests: 100,
            window: 60 // seconds
        },
        
        // Quality of Service for mobile
        qos: {
            priority: 'high',
            bandwidth: '10Mbps'
        }
    }
};
```

### Auto-scaling Configuration

```yaml
# mobile-autoscaling.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: infinity-storm-mobile
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: infinity-storm-mobile
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  # Custom metric for mobile active sessions
  - type: Object
    object:
      metric:
        name: mobile_active_sessions
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 600
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

---

## Incident Response

### Mobile Incident Response Playbook

```bash
#!/bin/bash
# mobile-incident-response.sh

INCIDENT_TYPE=${1:-"unknown"}
SEVERITY=${2:-"medium"}

echo "🚨 Mobile Incident Response Activated"
echo "Type: $INCIDENT_TYPE | Severity: $SEVERITY"

case $INCIDENT_TYPE in
    "orientation-failure")
        echo "📱 Handling orientation system failure..."
        
        # Check orientation system health
        curl -sf https://infinitystorm.com/api/mobile/orientation/health
        
        # Restart orientation services
        pm2 restart orientation-service
        
        # Enable fallback mode
        curl -X POST https://infinitystorm.com/api/mobile/fallback-mode -d '{"enable": true}'
        ;;
        
    "performance-degradation")
        echo "⚡ Handling performance degradation..."
        
        # Enable performance mode
        curl -X POST https://infinitystorm.com/api/mobile/performance-mode -d '{"level": "aggressive"}'
        
        # Scale up mobile servers
        kubectl scale deployment infinity-storm-mobile --replicas=10
        
        # Reduce animation quality
        curl -X POST https://infinitystorm.com/api/mobile/optimize -d '{"animations": "minimal"}'
        ;;
        
    "high-error-rate")
        echo "❌ Handling high error rate..."
        
        # Enable error collection mode
        curl -X POST https://infinitystorm.com/api/mobile/debug -d '{"errorLogging": "verbose"}'
        
        # Switch to stable version
        kubectl set image deployment/infinity-storm-mobile app=infinity-storm:stable
        
        # Alert development team
        curl -X POST "$SLACK_WEBHOOK" -d '{"text": "🚨 Mobile high error rate detected"}'
        ;;
        
    *)
        echo "🔍 Generic incident response..."
        
        # Collect system status
        ./scripts/mobile-system-status.sh > /tmp/mobile-status-$(date +%Y%m%d_%H%M%S).log
        
        # Enable debug mode
        curl -X POST https://infinitystorm.com/api/mobile/debug -d '{"enable": true}'
        ;;
esac

echo "✅ Initial incident response complete"
echo "📋 Next steps: Review logs, monitor metrics, prepare detailed report"
```

### Mobile System Status Check

```bash
#!/bin/bash
# mobile-system-status.sh

echo "📱 Mobile System Status Report - $(date)"
echo "================================================"

# Server health
echo "🖥️  Server Health:"
curl -sf https://infinitystorm.com/api/health | jq '.'

# Mobile-specific health
echo -e "\n📱 Mobile Health:"
curl -sf https://infinitystorm.com/api/mobile/health | jq '.'

# Performance metrics
echo -e "\n📊 Performance Metrics:"
curl -sf https://infinitystorm.com/api/mobile/metrics | jq '.'

# Error rates
echo -e "\n❌ Error Rates (Last Hour):"
curl -sf https://infinitystorm.com/api/mobile/errors?period=1h | jq '.'

# Active mobile sessions
echo -e "\n👥 Active Mobile Sessions:"
curl -sf https://infinitystorm.com/api/mobile/sessions | jq '.count'

# Resource usage
echo -e "\n💻 Resource Usage:"
free -h
df -h /var/www/infinity-storm-production

# Service status
echo -e "\n🔧 Service Status:"
pm2 status | grep -E "(infinity-storm|mobile)"

# Recent mobile logs
echo -e "\n📋 Recent Mobile Errors (Last 10):"
tail -10 /var/log/infinity-storm/mobile-errors.log

echo -e "\n✅ Status report complete"
```

---

This comprehensive deployment and maintenance guide provides all the necessary procedures and tools for successfully operating the Infinity Storm mobile system in production. Regular execution of these maintenance tasks and adherence to the monitoring procedures will ensure optimal mobile performance and user experience.