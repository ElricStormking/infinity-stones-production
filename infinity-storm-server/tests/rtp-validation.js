/**
 * RTP Validation Test Suite
 *
 * Performs large-scale statistical validation of the game's RTP (Return to Player)
 * by simulating thousands of spins and analyzing the results.
 *
 * Target RTP: 96.5%
 * Acceptable Variance: ±2% (94.5% - 98.5%)
 * Test Size: 10,000+ spins
 *
 * Statistical Analysis:
 * - Overall RTP calculation
 * - Win frequency distribution
 * - Payout distribution by size
 * - Cluster size analysis
 * - Multiplier frequency and impact
 * - Free spins trigger rate and value
 * - Cascade depth distribution
 */

const GameEngine = require('../src/game/gameEngine');
const { logger } = require('../src/utils/logger');

// Configuration
const TEST_CONFIG = {
  totalSpins: 100000,
  betAmount: 1.0,
  reportInterval: 10000, // Report progress every N spins
  enableDetailedLogging: false,
  enableProgressBar: true
};

// Statistics tracking
class RTPStatistics {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalSpins = 0;
    this.totalWagered = 0;
    this.totalWon = 0;
    this.totalLost = 0;

    // Win distribution
    this.winningSpins = 0;
    this.losingSpins = 0;
    this.winsByCategory = {
      small: 0,    // 1-5x
      medium: 0,   // 5-10x
      big: 0,      // 10-25x
      mega: 0,     // 25-50x
      epic: 0,     // 50-100x
      legendary: 0 // 100x+
    };

    // Payout tracking
    this.largestWin = 0;
    this.largestWinMultiplier = 0;
    this.payoutDistribution = [];

    // Cascade analysis
    this.totalCascades = 0;
    this.cascadesByDepth = {};
    this.maxCascadeDepth = 0;

    // Cluster analysis
    this.clusterSizeDistribution = {};
    this.totalClusters = 0;

    // Multiplier analysis
    this.multiplierTriggers = 0;
    this.multiplierDistribution = {};
    this.totalMultiplierValue = 0;

    // Free spins analysis
    this.freeSpinsTriggers = 0;
    this.freeSpinsAwarded = 0;
    this.freeSpinsPlayed = 0;
    this.freeSpinsTotalWin = 0;

    // Symbol distribution
    this.symbolAppearances = {};

    // Timing
    this.startTime = null;
    this.endTime = null;
    this.avgProcessingTime = 0;
  }

  recordSpin(spinResult, betAmount) {
    this.totalSpins++;
    this.totalWagered += betAmount;
    this.totalWon += spinResult.totalWin;

    if (spinResult.totalWin > 0) {
      this.winningSpins++;
      this.totalLost += betAmount - spinResult.totalWin;

      // Categorize win
      const multiplier = spinResult.totalWin / betAmount;
      if (multiplier >= 100) {this.winsByCategory.legendary++;}
      else if (multiplier >= 50) {this.winsByCategory.epic++;}
      else if (multiplier >= 25) {this.winsByCategory.mega++;}
      else if (multiplier >= 10) {this.winsByCategory.big++;}
      else if (multiplier >= 5) {this.winsByCategory.medium++;}
      else {this.winsByCategory.small++;}

      // Track largest win
      if (spinResult.totalWin > this.largestWin) {
        this.largestWin = spinResult.totalWin;
        this.largestWinMultiplier = multiplier;
      }

      // Store payout for distribution analysis
      this.payoutDistribution.push(spinResult.totalWin);
    } else {
      this.losingSpins++;
      this.totalLost += betAmount;
    }

    // Cascade analysis
    const cascadeCount = spinResult.cascadeSteps?.length || 0;
    this.totalCascades += cascadeCount;
    this.cascadesByDepth[cascadeCount] = (this.cascadesByDepth[cascadeCount] || 0) + 1;
    if (cascadeCount > this.maxCascadeDepth) {
      this.maxCascadeDepth = cascadeCount;
    }

    // Cluster analysis
    if (spinResult.cascadeSteps) {
      spinResult.cascadeSteps.forEach(cascade => {
        if (cascade.matchedClusters) {
          cascade.matchedClusters.forEach(cluster => {
            this.totalClusters++;
            const size = cluster.positions?.length || cluster.size;
            this.clusterSizeDistribution[size] = (this.clusterSizeDistribution[size] || 0) + 1;
          });
        }
      });
    }

    // Multiplier analysis
    if (spinResult.multiplierAwarded && spinResult.multiplierAwarded > 1) {
      this.multiplierTriggers++;
      const mult = spinResult.multiplierAwarded;
      this.multiplierDistribution[mult] = (this.multiplierDistribution[mult] || 0) + 1;
      this.totalMultiplierValue += mult;
    }

    // Free spins analysis
    if (spinResult.bonusFeatures?.freeSpinsAwarded) {
      this.freeSpinsTriggers++;
      this.freeSpinsAwarded += spinResult.bonusFeatures.freeSpinsAwarded;
    }

    // Symbol distribution (from initial grid)
    if (spinResult.initialGrid) {
      spinResult.initialGrid.forEach(column => {
        column.forEach(symbol => {
          this.symbolAppearances[symbol] = (this.symbolAppearances[symbol] || 0) + 1;
        });
      });
    }
  }

  calculateRTP() {
    if (this.totalWagered === 0) {return 0;}
    return (this.totalWon / this.totalWagered) * 100;
  }

  getReport() {
    const rtp = this.calculateRTP();
    const hitFrequency = (this.winningSpins / this.totalSpins) * 100;
    const avgWin = this.winningSpins > 0 ? this.totalWon / this.winningSpins : 0;
    const avgCascades = this.totalCascades / this.totalSpins;
    const avgClustersPerSpin = this.totalClusters / this.totalSpins;

    return {
      // Overall RTP
      rtp: rtp.toFixed(4),
      targetRTP: 96.5,
      variance: (rtp - 96.5).toFixed(4),
      withinTarget: rtp >= 94.5 && rtp <= 98.5,

      // Spin statistics
      totalSpins: this.totalSpins,
      totalWagered: this.totalWagered.toFixed(2),
      totalWon: this.totalWon.toFixed(2),
      totalLost: this.totalLost.toFixed(2),

      // Win frequency
      winningSpins: this.winningSpins,
      losingSpins: this.losingSpins,
      hitFrequency: hitFrequency.toFixed(2) + '%',
      avgWin: avgWin.toFixed(2),
      largestWin: this.largestWin.toFixed(2),
      largestWinMultiplier: this.largestWinMultiplier.toFixed(2) + 'x',

      // Win distribution
      winDistribution: {
        small: this.winsByCategory.small,
        medium: this.winsByCategory.medium,
        big: this.winsByCategory.big,
        mega: this.winsByCategory.mega,
        epic: this.winsByCategory.epic,
        legendary: this.winsByCategory.legendary
      },

      // Cascade analysis
      totalCascades: this.totalCascades,
      avgCascadesPerSpin: avgCascades.toFixed(2),
      maxCascadeDepth: this.maxCascadeDepth,
      cascadeDistribution: this.cascadesByDepth,

      // Cluster analysis
      totalClusters: this.totalClusters,
      avgClustersPerSpin: avgClustersPerSpin.toFixed(2),
      clusterSizeDistribution: this.clusterSizeDistribution,

      // Multiplier analysis
      multiplierTriggers: this.multiplierTriggers,
      multiplierFrequency: ((this.multiplierTriggers / this.totalSpins) * 100).toFixed(2) + '%',
      avgMultiplierValue: this.multiplierTriggers > 0 ? (this.totalMultiplierValue / this.multiplierTriggers).toFixed(2) : 0,
      multiplierDistribution: this.multiplierDistribution,

      // Free spins analysis
      freeSpinsTriggers: this.freeSpinsTriggers,
      freeSpinsTriggerRate: ((this.freeSpinsTriggers / this.totalSpins) * 100).toFixed(2) + '%',
      freeSpinsAwarded: this.freeSpinsAwarded,

      // Symbol distribution
      symbolDistribution: this.symbolAppearances,

      // Performance
      totalTime: this.endTime && this.startTime ? ((this.endTime - this.startTime) / 1000).toFixed(2) + 's' : 'N/A',
      avgProcessingTime: this.avgProcessingTime.toFixed(2) + 'ms'
    };
  }
}

// Progress bar utility
function drawProgressBar(current, total, width = 50) {
  const percentage = (current / total) * 100;
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const line = `\r[${bar}] ${percentage.toFixed(1)}% (${current}/${total})`;
  process.stdout.write(line);
}

// Main RTP validation function
async function runRTPValidation() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     INFINITY STORM - RTP VALIDATION TEST SUITE              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log(`  Total Spins: ${TEST_CONFIG.totalSpins.toLocaleString()}`);
  console.log(`  Bet Amount: $${TEST_CONFIG.betAmount.toFixed(2)}`);
  console.log('  Target RTP: 96.5%');
  console.log('  Acceptable Range: 94.5% - 98.5%\n');

  const stats = new RTPStatistics();
  const gameEngine = new GameEngine();

  stats.startTime = Date.now();
  let totalProcessingTime = 0;

  console.log('Running simulation...\n');

  for (let i = 0; i < TEST_CONFIG.totalSpins; i++) {
    const spinStart = Date.now();

    try {
      // Run spin
      const spinResult = await gameEngine.processCompleteSpin({
        betAmount: TEST_CONFIG.betAmount,
        freeSpinsActive: false,
        accumulatedMultiplier: 1.0,
        quickSpinMode: false
      });

      // Record statistics
      stats.recordSpin(spinResult, TEST_CONFIG.betAmount);

      // Track processing time
      const spinTime = Date.now() - spinStart;
      totalProcessingTime += spinTime;

      // Progress reporting
      if (TEST_CONFIG.enableProgressBar && (i + 1) % 100 === 0) {
        drawProgressBar(i + 1, TEST_CONFIG.totalSpins);
      }

      if (TEST_CONFIG.enableDetailedLogging && (i + 1) % TEST_CONFIG.reportInterval === 0) {
        const currentRTP = stats.calculateRTP();
        console.log(`\n  Spins: ${i + 1} | Current RTP: ${currentRTP.toFixed(2)}% | Wins: ${stats.winningSpins} (${((stats.winningSpins / (i + 1)) * 100).toFixed(1)}%)`);
      }

    } catch (error) {
      console.error(`\n❌ Error on spin ${i + 1}:`, error.message);
      if (TEST_CONFIG.enableDetailedLogging) {
        console.error(error.stack);
      }
    }
  }

  stats.endTime = Date.now();
  stats.avgProcessingTime = totalProcessingTime / TEST_CONFIG.totalSpins;

  if (TEST_CONFIG.enableProgressBar) {
    console.log('\n'); // New line after progress bar
  }

  return stats;
}

// Generate detailed report
function generateReport(stats) {
  const report = stats.getReport();

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    VALIDATION RESULTS                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // RTP Analysis
  console.log('📊 RTP ANALYSIS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Calculated RTP:        ${report.rtp}%`);
  console.log(`  Target RTP:            ${report.targetRTP}%`);
  console.log(`  Variance:              ${report.variance}%`);
  console.log(`  Within Target Range:   ${report.withinTarget ? '✅ YES' : '❌ NO'}`);
  console.log(`  Total Wagered:         $${report.totalWagered}`);
  console.log(`  Total Won:             $${report.totalWon}`);
  console.log(`  Total Lost:            $${report.totalLost}\n`);

  // Win Frequency
  console.log('🎯 WIN FREQUENCY');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Total Spins:           ${report.totalSpins.toLocaleString()}`);
  console.log(`  Winning Spins:         ${report.winningSpins.toLocaleString()} (${report.hitFrequency})`);
  console.log(`  Losing Spins:          ${report.losingSpins.toLocaleString()}`);
  console.log(`  Average Win:           $${report.avgWin}`);
  console.log(`  Largest Win:           $${report.largestWin} (${report.largestWinMultiplier})\n`);

  // Win Distribution
  console.log('💎 WIN DISTRIBUTION BY SIZE');
  console.log('─────────────────────────────────────────────────────────────');
  const winDist = report.winDistribution;
  console.log(`  Small (1-5x):          ${winDist.small.toLocaleString()}`);
  console.log(`  Medium (5-10x):        ${winDist.medium.toLocaleString()}`);
  console.log(`  Big (10-25x):          ${winDist.big.toLocaleString()}`);
  console.log(`  Mega (25-50x):         ${winDist.mega.toLocaleString()}`);
  console.log(`  Epic (50-100x):        ${winDist.epic.toLocaleString()}`);
  console.log(`  Legendary (100x+):     ${winDist.legendary.toLocaleString()}\n`);

  // Cascade Analysis
  console.log('⚡ CASCADE ANALYSIS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Total Cascades:        ${report.totalCascades.toLocaleString()}`);
  console.log(`  Avg per Spin:          ${report.avgCascadesPerSpin}`);
  console.log(`  Max Depth:             ${report.maxCascadeDepth}`);
  console.log('  Distribution:');
  Object.keys(report.cascadeDistribution)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(depth => {
      const count = report.cascadeDistribution[depth];
      const pct = ((count / report.totalSpins) * 100).toFixed(1);
      console.log(`    ${depth} cascades:  ${count.toLocaleString()} (${pct}%)`);
    });
  console.log();

  // Cluster Analysis
  console.log('🔷 CLUSTER ANALYSIS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Total Clusters:        ${report.totalClusters.toLocaleString()}`);
  console.log(`  Avg per Spin:          ${report.avgClustersPerSpin}`);
  console.log('  Size Distribution:');
  Object.keys(report.clusterSizeDistribution)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(size => {
      const count = report.clusterSizeDistribution[size];
      const pct = ((count / report.totalClusters) * 100).toFixed(1);
      console.log(`    Size ${size}:  ${count.toLocaleString()} (${pct}%)`);
    });
  console.log();

  // Multiplier Analysis
  console.log('✨ MULTIPLIER ANALYSIS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Total Triggers:        ${report.multiplierTriggers.toLocaleString()}`);
  console.log(`  Trigger Rate:          ${report.multiplierFrequency}`);
  console.log(`  Avg Multiplier:        ${report.avgMultiplierValue}x`);
  if (Object.keys(report.multiplierDistribution).length > 0) {
    console.log('  Distribution:');
    Object.keys(report.multiplierDistribution)
      .sort((a, b) => Number(a) - Number(b))
      .forEach(mult => {
        const count = report.multiplierDistribution[mult];
        console.log(`    ${mult}x:  ${count.toLocaleString()}`);
      });
  }
  console.log();

  // Free Spins Analysis
  console.log('🎰 FREE SPINS ANALYSIS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Total Triggers:        ${report.freeSpinsTriggers.toLocaleString()}`);
  console.log(`  Trigger Rate:          ${report.freeSpinsTriggerRate}`);
  console.log(`  Total Awarded:         ${report.freeSpinsAwarded.toLocaleString()}\n`);

  // Performance
  console.log('⚙️  PERFORMANCE METRICS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Total Time:            ${report.totalTime}`);
  console.log(`  Avg Processing Time:   ${report.avgProcessingTime}\n`);

  // Final Verdict
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  if (report.withinTarget) {
    console.log('║  ✅ VALIDATION PASSED - RTP WITHIN ACCEPTABLE RANGE         ║');
  } else {
    console.log('║  ❌ VALIDATION FAILED - RTP OUTSIDE ACCEPTABLE RANGE        ║');
  }
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  return report;
}

// Export for use in other tests
module.exports = {
  runRTPValidation,
  RTPStatistics,
  TEST_CONFIG
};

// Run if called directly
if (require.main === module) {
  (async () => {
    try {
      const stats = await runRTPValidation();
      const report = generateReport(stats);

      // Exit with appropriate code
      process.exit(report.withinTarget ? 0 : 1);

    } catch (error) {
      console.error('\n❌ Fatal error during RTP validation:');
      console.error(error);
      process.exit(1);
    }
  })();
}

