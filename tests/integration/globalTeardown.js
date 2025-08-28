/**
 * Global Teardown for Integration Tests
 * 
 * Task 8.1: Global test environment cleanup
 * 
 * This file handles cleanup after all integration tests complete,
 * ensuring proper resource cleanup and final reporting.
 */

const fs = require('fs');
const path = require('path');

module.exports = async function globalTeardown() {
    console.log('🧹 Starting global integration test cleanup...');

    // Clean up test databases
    await cleanupTestDatabase();

    // Clean up test Redis
    await cleanupTestRedis();

    // Clean up test services
    await cleanupTestServices();

    // Clean up temporary files
    await cleanupTemporaryFiles();

    // Generate final test summary
    await generateTestSummary();

    // Force garbage collection if available
    if (global.gc) {
        console.log('🗑️ Running garbage collection...');
        global.gc();
    }

    console.log('✅ Global cleanup complete');
};

async function cleanupTestDatabase() {
    console.log('🗄️ Cleaning up test database...');

    if (global.testDatabase) {
        try {
            // Clear all test data
            global.testDatabase.clear();
            
            // Log cleanup statistics
            console.log('   ✓ Database cleared');
        } catch (error) {
            console.warn('   ⚠️ Database cleanup error:', error.message);
        }
    }

    // Remove database reference
    delete global.testDatabase;
}

async function cleanupTestRedis() {
    console.log('📦 Cleaning up test Redis...');

    if (global.testRedis) {
        try {
            // Clear all Redis data
            global.testRedis.clear();
            console.log('   ✓ Redis cleared');
        } catch (error) {
            console.warn('   ⚠️ Redis cleanup error:', error.message);
        }
    }

    // Remove Redis reference
    delete global.testRedis;
}

async function cleanupTestServices() {
    console.log('🔧 Cleaning up test services...');

    if (global.testServices) {
        try {
            // Clean up any service resources
            const services = Object.keys(global.testServices);
            console.log(`   ✓ Cleaned up ${services.length} services: ${services.join(', ')}`);
        } catch (error) {
            console.warn('   ⚠️ Service cleanup error:', error.message);
        }
    }

    // Remove services reference
    delete global.testServices;
}

async function cleanupTemporaryFiles() {
    console.log('📁 Cleaning up temporary files...');

    const tempDirs = [
        'tests/tmp',
        'tests/logs'
    ];

    for (const tempDir of tempDirs) {
        const dirPath = path.join(process.cwd(), tempDir);
        
        try {
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isFile()) {
                        fs.unlinkSync(filePath);
                    }
                }
                
                console.log(`   ✓ Cleaned ${files.length} files from ${tempDir}`);
            }
        } catch (error) {
            console.warn(`   ⚠️ Error cleaning ${tempDir}:`, error.message);
        }
    }
}

async function generateTestSummary() {
    console.log('📊 Generating test summary...');

    const summaryData = {
        completedAt: new Date().toISOString(),
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        },
        testConfiguration: {
            nodeEnv: process.env.NODE_ENV,
            testMode: process.env.TEST_MODE,
            jestWorkers: process.env.JEST_WORKER_ID || 'main'
        },
        cleanup: {
            databaseCleaned: !global.testDatabase,
            redisCleaned: !global.testRedis,
            servicesCleaned: !global.testServices
        }
    };

    try {
        const summaryPath = path.join(process.cwd(), 'coverage/integration/teardown-summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
        console.log(`   ✓ Summary saved to: ${summaryPath}`);
    } catch (error) {
        console.warn('   ⚠️ Could not save test summary:', error.message);
    }

    // Log memory usage for debugging
    const memoryUsage = process.memoryUsage();
    console.log('   📈 Final memory usage:');
    console.log(`      RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`      Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`      Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`      External: ${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`);
}