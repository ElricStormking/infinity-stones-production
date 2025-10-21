/**
 * RTP Validation Test Suite - FREE SPINS MODE
 * 
 * Tests free spins mode with accumulated multipliers to validate:
 * - Accumulated multiplier progression (1x → 2x → 3x, etc.)
 * - Win calculation with multipliers applied
 * - Free spins RTP contribution
 * - Multiplier trigger rates during free spins
 * 
 * Target: Validate free spins mode maintains overall game RTP
 */

const GameEngine = require('../src/game/gameEngine');

// Configuration
const TEST_CONFIG = {
  totalFreeSpinSessions: 1000, // Number of free spin sessions to test
  freeSpinsPerSession: 15,     // Standard free spins award
  betAmount: 1.0,
  reportInterval: 100,
  enableDetailedLogging: false,
  enableProgressBar: true
};

// Statistics tracking for free spins
class FreeSpinsStatistics {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalSessions = 0;
    this.totalSpins = 0;
    this.totalWagered = 0;
    this.totalWon = 0;
    
    // Multiplier tracking
    this.multiplierDistribution = {};
    this.maxMultiplierReached = 1;
    this.avgMultiplierPerSession = 0;
    this.totalMultiplierValue = 0;
    
    // Win tracking
    this.winningSpins = 0;
    this.totalWinBeforeMultipliers = 0;
    this.totalWinAfterMultipliers = 0;
    this.largestWin = 0;
    this.largestWinMultiplier = 0;
    
    // Cascade tracking
    this.totalCascades = 0;
    this.cascadesWithMultiplier = 0;
    
    // Retrigger tracking
    this.retriggers = 0;
    this.additionalFreeSpinsAwarded = 0;
    
    // Session data
    this.sessionData = [];
    
    // Timing
    this.startTime = null;
    this.endTime = null;
  }

  recordSession(sessionResult) {
    this.totalSessions++;
    this.totalSpins += sessionResult.spinsPlayed;
    this.totalWagered += sessionResult.totalWagered;
    this.totalWon += sessionResult.totalWon;
    
    // Track multipliers
    if (sessionResult.finalMultiplier > this.maxMultiplierReached) {
      this.maxMultiplierReached = sessionResult.finalMultiplier;
    }
    this.totalMultiplierValue += sessionResult.finalMultiplier;
    
    // Track wins
    this.winningSpins += sessionResult.winningSpins;
    this.totalWinBeforeMultipliers += sessionResult.baseWin;
    this.totalWinAfterMultipliers += sessionResult.totalWon;
    
    if (sessionResult.largestWin > this.largestWin) {
      this.largestWin = sessionResult.largestWin;
      this.largestWinMultiplier = sessionResult.largestWinMultiplier;
    }
    
    // Track cascades
    this.totalCascades += sessionResult.cascades;
    this.cascadesWithMultiplier += sessionResult.cascadesWithMultiplier;
    
    // Track retriggers
    if (sessionResult.retriggered) {
      this.retriggers++;
      this.additionalFreeSpinsAwarded += sessionResult.additionalSpins;
    }
    
    // Store session data
    this.sessionData.push({
      sessionId: this.totalSessions,
      spins: sessionResult.spinsPlayed,
      won: sessionResult.totalWon,
      finalMultiplier: sessionResult.finalMultiplier,
      retriggered: sessionResult.retriggered
    });
  }

  calculateRTP() {
    if (this.totalWagered === 0) return 0;
    return (this.totalWon / this.totalWagered) * 100;
  }

  getReport() {
    const rtp = this.calculateRTP();
    this.avgMultiplierPerSession = this.totalMultiplierValue / this.totalSessions;
    
    return {
      // Free Spins RTP
      rtp: rtp.toFixed(4),
      totalSessions: this.totalSessions,
      totalSpins: this.totalSpins,
      avgSpinsPerSession: (this.totalSpins / this.totalSessions).toFixed(2),
      totalWagered: this.totalWagered.toFixed(2),
      totalWon: this.totalWon.toFixed(2),
      
      // Win frequency
      winningSpins: this.winningSpins,
      hitFrequency: ((this.winningSpins / this.totalSpins) * 100).toFixed(2) + '%',
      largestWin: this.largestWin.toFixed(2),
      largestWinMultiplier: this.largestWinMultiplier.toFixed(2) + 'x',
      
      // Multiplier analysis
      maxMultiplierReached: this.maxMultiplierReached,
      avgMultiplierPerSession: this.avgMultiplierPerSession.toFixed(2),
      
      // Win comparison
      totalWinBeforeMultipliers: this.totalWinBeforeMultipliers.toFixed(2),
      totalWinAfterMultipliers: this.totalWinAfterMultipliers.toFixed(2),
      multiplierImpact: ((this.totalWinAfterMultipliers / this.totalWinBeforeMultipliers)).toFixed(2) + 'x',
      
      // Cascade analysis
      totalCascades: this.totalCascades,
      avgCascadesPerSpin: (this.totalCascades / this.totalSpins).toFixed(2),
      cascadesWithMultiplier: this.cascadesWithMultiplier,
      multiplierTriggerRate: ((this.cascadesWithMultiplier / this.totalCascades) * 100).toFixed(2) + '%',
      
      // Retrigger analysis
      retriggers: this.retriggers,
      retriggerRate: ((this.retriggers / this.totalSessions) * 100).toFixed(2) + '%',
      additionalFreeSpinsAwarded: this.additionalFreeSpinsAwarded,
      
      // Performance
      totalTime: this.endTime && this.startTime ? ((this.endTime - this.startTime) / 1000).toFixed(2) + 's' : 'N/A'
    };
  }
}

// Progress bar
function drawProgressBar(current, total, width = 50) {
  const percentage = (current / total) * 100;
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const line = `\r[${bar}] ${percentage.toFixed(1)}% (${current}/${total})`;
  process.stdout.write(line);
}

// Run a single free spins session
async function runFreeSpinsSession(gameEngine, freeSpinsCount, betAmount) {
  const sessionResult = {
    spinsPlayed: 0,
    totalWagered: 0,
    totalWon: 0,
    baseWin: 0,
    cascades: 0,
    cascadesWithMultiplier: 0,
    retriggered: false,
    additionalSpins: 0,
    winningSpins: 0,
    largestWin: 0,
    largestWinMultiplier: 0,
    finalMultiplier: 1.0
  };
  
  let accumulatedMultiplier = 1.0;
  let remainingFreeSpins = freeSpinsCount;
  
  while (remainingFreeSpins > 0) {
    try {
      const spinResult = await gameEngine.processCompleteSpin({
        betAmount,
        freeSpinsActive: true,
        freeSpinsRemaining: remainingFreeSpins,
        accumulatedMultiplier,
        quickSpinMode: false
      });
      
      sessionResult.spinsPlayed++;
      sessionResult.totalWagered += betAmount;
      sessionResult.totalWon += spinResult.totalWin || 0;
      
      // Track cascades
      const cascadeCount = spinResult.cascadeSteps?.length || 0;
      sessionResult.cascades += cascadeCount;
      
      // Track multiplier progression
      if (spinResult.newAccumulatedMultiplier) {
        accumulatedMultiplier = spinResult.newAccumulatedMultiplier;
        if (cascadeCount > 0) {
          sessionResult.cascadesWithMultiplier++;
        }
      }
      
      // Track wins
      if (spinResult.totalWin > 0) {
        sessionResult.winningSpins++;
        if (spinResult.totalWin > sessionResult.largestWin) {
          sessionResult.largestWin = spinResult.totalWin;
          sessionResult.largestWinMultiplier = accumulatedMultiplier;
        }
      }
      
      // Check for retrigger
      if (spinResult.bonusFeatures?.freeSpinsAwarded > 0) {
        sessionResult.retriggered = true;
        sessionResult.additionalSpins += spinResult.bonusFeatures.freeSpinsAwarded;
        remainingFreeSpins += spinResult.bonusFeatures.freeSpinsAwarded;
      }
      
      remainingFreeSpins--;
      
    } catch (error) {
      console.error(`\n❌ Error in free spin:`, error.message);
      break;
    }
  }
  
  sessionResult.finalMultiplier = accumulatedMultiplier;
  return sessionResult;
}

// Main validation function
async function runFreeSpinsValidation() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   INFINITY STORM - FREE SPINS MODE RTP VALIDATION           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Configuration:`);
  console.log(`  Free Spins Sessions: ${TEST_CONFIG.totalFreeSpinSessions.toLocaleString()}`);
  console.log(`  Spins per Session: ${TEST_CONFIG.freeSpinsPerSession}`);
  console.log(`  Bet Amount: $${TEST_CONFIG.betAmount.toFixed(2)}`);
  console.log(`  Total Spins: ${(TEST_CONFIG.totalFreeSpinSessions * TEST_CONFIG.freeSpinsPerSession).toLocaleString()}\n`);
  
  const stats = new FreeSpinsStatistics();
  const gameEngine = new GameEngine();
  
  stats.startTime = Date.now();
  
  console.log('Running free spins sessions...\n');
  
  for (let i = 0; i < TEST_CONFIG.totalFreeSpinSessions; i++) {
    try {
      const sessionResult = await runFreeSpinsSession(
        gameEngine,
        TEST_CONFIG.freeSpinsPerSession,
        TEST_CONFIG.betAmount
      );
      
      stats.recordSession(sessionResult);
      
      // Progress reporting
      if (TEST_CONFIG.enableProgressBar && (i + 1) % 10 === 0) {
        drawProgressBar(i + 1, TEST_CONFIG.totalFreeSpinSessions);
      }
      
    } catch (error) {
      console.error(`\n❌ Error on session ${i + 1}:`, error.message);
    }
  }
  
  stats.endTime = Date.now();
  
  if (TEST_CONFIG.enableProgressBar) {
    console.log('\n');
  }
  
  return stats;
}

// Generate report
function generateReport(stats) {
  const report = stats.getReport();
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║            FREE SPINS MODE VALIDATION RESULTS                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Free Spins RTP
  console.log('🎰 FREE SPINS RTP ANALYSIS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Free Spins RTP:        ${report.rtp}%`);
  console.log(`  Total Sessions:        ${report.totalSessions.toLocaleString()}`);
  console.log(`  Total Spins:           ${report.totalSpins.toLocaleString()}`);
  console.log(`  Avg Spins/Session:     ${report.avgSpinsPerSession}`);
  console.log(`  Total Wagered:         $${report.totalWagered}`);
  console.log(`  Total Won:             $${report.totalWon}\n`);
  
  // Win Frequency
  console.log('🎯 WIN FREQUENCY IN FREE SPINS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Winning Spins:         ${report.winningSpins.toLocaleString()}`);
  console.log(`  Hit Frequency:         ${report.hitFrequency}`);
  console.log(`  Largest Win:           $${report.largestWin} (${report.largestWinMultiplier})\n`);
  
  // Multiplier Analysis
  console.log('✨ ACCUMULATED MULTIPLIER ANALYSIS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Max Multiplier Reached:   ${report.maxMultiplierReached}x`);
  console.log(`  Avg Multiplier/Session:   ${report.avgMultiplierPerSession}x`);
  console.log(`  Total Cascades:           ${report.totalCascades.toLocaleString()}`);
  console.log(`  Avg Cascades/Spin:        ${report.avgCascadesPerSpin}`);
  console.log(`  Cascades with Multiplier: ${report.cascadesWithMultiplier.toLocaleString()}`);
  console.log(`  Multiplier Trigger Rate:  ${report.multiplierTriggerRate}\n`);
  
  // Multiplier Impact
  console.log('💎 MULTIPLIER IMPACT ON WINS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Wins Before Multipliers:  $${report.totalWinBeforeMultipliers}`);
  console.log(`  Wins After Multipliers:   $${report.totalWinAfterMultipliers}`);
  console.log(`  Multiplier Impact:        ${report.multiplierImpact} boost\n`);
  
  // Retrigger Analysis
  console.log('🔄 RETRIGGER ANALYSIS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Total Retriggers:         ${report.retriggers.toLocaleString()}`);
  console.log(`  Retrigger Rate:           ${report.retriggerRate}`);
  console.log(`  Additional Spins Awarded: ${report.additionalFreeSpinsAwarded.toLocaleString()}\n`);
  
  // Performance
  console.log('⚙️  PERFORMANCE METRICS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Total Time:               ${report.totalTime}\n`);
  
  // Final Verdict
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ FREE SPINS MODE VALIDATION COMPLETE                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  return report;
}

// Export for use in other tests
module.exports = {
  runFreeSpinsValidation,
  FreeSpinsStatistics,
  TEST_CONFIG
};

// Run if called directly
if (require.main === module) {
  (async () => {
    try {
      const stats = await runFreeSpinsValidation();
      const report = generateReport(stats);
      
      process.exit(0);
      
    } catch (error) {
      console.error('\n❌ Fatal error during free spins validation:');
      console.error(error);
      process.exit(1);
    }
  })();
}





