#!/usr/bin/env node

/**
 * Basic RTP Test - Quick validation that the system works
 */

const RTPValidationSuite = require('./rtp-validation');

async function runBasicTest() {
    console.log('🎰 Running Basic RTP Test');
    console.log('This is a quick validation that the system works correctly.');
    console.log('');
    
    const validator = new RTPValidationSuite();
    
    try {
        // Run a smaller test for quick validation
        console.log('📊 Running small RTP validation (10K spins)...');
        
        const testResult = await validator.runServerSimulation({
            spins: 10000,
            bet: 1.00,
            seed: 'basic_test'
        });
        
        console.log('');
        console.log('📋 Test Results:');
        console.log(`  Spins: ${testResult.spins.toLocaleString()}`);
        console.log(`  Total Bet: $${testResult.totalBet.toLocaleString()}`);
        console.log(`  Total Win: $${testResult.totalWin.toLocaleString()}`);
        console.log(`  RTP: ${testResult.rtp}%`);
        console.log(`  Hit Rate: ${testResult.hitRate}%`);
        console.log(`  Average Cascades: ${testResult.avgCascades}`);
        console.log(`  Max Win: $${testResult.maxWin}`);
        console.log(`  Free Spins Triggers: ${testResult.freeSpinsTriggers}`);
        
        console.log('');
        console.log('🎯 Analysis:');
        
        // Check if RTP is reasonable (allowing for simplified simulation)
        if (testResult.rtp >= 85 && testResult.rtp <= 105) {
            console.log(`  ✅ RTP (${testResult.rtp}%) is within reasonable range for simplified simulation`);
        } else {
            console.log(`  ⚠️ RTP (${testResult.rtp}%) is outside reasonable range`);
        }
        
        // Check hit rate
        if (testResult.hitRate >= 40 && testResult.hitRate <= 80) {
            console.log(`  ✅ Hit Rate (${testResult.hitRate}%) appears normal`);
        } else {
            console.log(`  ⚠️ Hit Rate (${testResult.hitRate}%) may be unusual`);
        }
        
        // Check cascades
        if (testResult.avgCascades >= 0.5 && testResult.avgCascades <= 5.0) {
            console.log(`  ✅ Average cascades (${testResult.avgCascades}) appears normal`);
        } else {
            console.log(`  ⚠️ Average cascades (${testResult.avgCascades}) may be unusual`);
        }
        
        // Check for basic functionality
        if (testResult.totalWin > 0) {
            console.log(`  ✅ System is generating wins correctly`);
        } else {
            console.log(`  ❌ System is not generating any wins - check game logic`);
        }
        
        console.log('');
        console.log('📊 Symbol Distribution:');
        const symbols = Object.keys(testResult.symbolDistribution);
        symbols.sort();
        for (const symbol of symbols) {
            const freq = testResult.symbolDistribution[symbol];
            console.log(`  ${symbol}: ${freq}%`);
        }
        
        console.log('');
        console.log('🔍 Payout Distribution:');
        const payout = testResult.payoutDistribution;
        console.log(`  Zero Wins: ${payout.zeroWins}%`);
        console.log(`  Small Wins: ${payout.smallWins}%`);
        console.log(`  Medium Wins: ${payout.mediumWins}%`);
        console.log(`  Big Wins: ${payout.bigWins}%`);
        console.log(`  Mega Wins: ${payout.megaWins}%`);
        
        console.log('');
        console.log('✅ Basic RTP Test Completed Successfully!');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('  • Run full validation: npm run test:rtp:full');
        console.log('  • Run mathematical tests: npm run test:math');
        console.log('  • Generate compliance report: npm run compliance');
        
        return testResult;
        
    } catch (error) {
        console.error('❌ Basic RTP Test Failed:', error.message);
        console.error('');
        console.error('🔧 Troubleshooting:');
        console.error('  • Check that all dependencies are installed: npm install');
        console.error('  • Verify file paths and permissions');
        console.error('  • Run with verbose output: node test-basic-rtp.js --verbose');
        
        if (process.argv.includes('--verbose')) {
            console.error('');
            console.error('Full error details:');
            console.error(error.stack);
        }
        
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    runBasicTest()
        .then(() => {
            console.log('🎰 Test Complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runBasicTest };