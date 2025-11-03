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
  totalSpins: 10000, // Quick test with updated scatter rate (4.2% per-symbol)
  betAmount: 1.0,
  reportInterval: 2500, // Report progress every N spins
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

    // Base game stats
    this.baseGameSpins = 0;
    this.baseGameWagered = 0;
    this.baseGameWon = 0;

    // Free spins stats
    this.freeSpinsSpins = 0;
    this.freeSpinsWon = 0;
    this.totalMultipliersAppeared = 0;

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
    this.freeSpinsRetriggers = 0;
    this.maxAccumulatedMultiplier = 1.0;

    // Symbol distribution
    this.symbolAppearances = {};

    // Timing
    this.startTime = null;
    this.endTime = null;
    this.avgProcessingTime = 0;
  }

  recordSpin(spinResult, betAmount, isFreeSpinMode = false) {
    this.totalSpins++;
    
    // Track base game vs free spins separately
    if (isFreeSpinMode) {
      this.freeSpinsSpins++;
      this.freeSpinsWon += spinResult.totalWin;
      this.freeSpinsTotalWin += spinResult.totalWin;
    } else {
      this.baseGameSpins++;
      this.baseGameWagered += betAmount;
      this.baseGameWon += spinResult.totalWin;
      this.totalWagered += betAmount;
    }
    
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

    // Multiplier analysis (track actual random multipliers)
    if (spinResult.bonusFeatures?.randomMultipliers && spinResult.bonusFeatures.randomMultipliers.length > 0) {
      spinResult.bonusFeatures.randomMultipliers.forEach(mult => {
        this.multiplierTriggers++;
        const multValue = mult.multiplier || 1;
        this.multiplierDistribution[multValue] = (this.multiplierDistribution[multValue] || 0) + 1;
        this.totalMultiplierValue += multValue;
      });
    }

    // Free spins analysis
    if (spinResult.bonusFeatures?.freeSpinsAwarded) {
      if (isFreeSpinMode) {
        this.freeSpinsRetriggers++;
      } else {
        this.freeSpinsTriggers++;
      }
      this.freeSpinsAwarded += spinResult.bonusFeatures.freeSpinsAwarded;
    }
    
    // Track max accumulated multiplier during free spins
    if (isFreeSpinMode && spinResult.newAccumulatedMultiplier) {
      if (spinResult.newAccumulatedMultiplier > this.maxAccumulatedMultiplier) {
        this.maxAccumulatedMultiplier = spinResult.newAccumulatedMultiplier;
      }
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
  
  calculateBaseGameRTP() {
    if (this.baseGameWagered === 0) {return 0;}
    return (this.baseGameWon / this.baseGameWagered) * 100;
  }
  
  calculateFreeSpinsRTP() {
    // Free spins contribute to total RTP through their wins
    if (this.freeSpinsSpins === 0) {return 0;}
    const avgBet = this.totalWagered / this.baseGameSpins;
    const freeSpinsWinPerSpin = this.freeSpinsWon / this.freeSpinsSpins;
    return (freeSpinsWinPerSpin / avgBet) * 100;
  }

  getReport() {
    const rtp = this.calculateRTP();
    const baseGameRTP = this.calculateBaseGameRTP();
    const freeSpinsRTP = this.calculateFreeSpinsRTP();
    const hitFrequency = (this.winningSpins / this.totalSpins) * 100;
    const avgWin = this.winningSpins > 0 ? this.totalWon / this.winningSpins : 0;
    const avgCascades = this.totalCascades / this.totalSpins;
    const avgClustersPerSpin = this.totalClusters / this.totalSpins;

    return {
      // Overall RTP
      rtp: rtp.toFixed(4),
      baseGameRTP: baseGameRTP.toFixed(4),
      freeSpinsRTP: freeSpinsRTP.toFixed(4),
      targetRTP: 96.5,
      variance: (rtp - 96.5).toFixed(4),
      withinTarget: rtp >= 94.5 && rtp <= 98.5,

      // Spin statistics
      totalSpins: this.totalSpins,
      baseGameSpins: this.baseGameSpins,
      freeSpinsPlayed: this.freeSpinsPlayed,
      totalWagered: this.totalWagered.toFixed(2),
      baseGameWagered: this.baseGameWagered.toFixed(2),
      totalWon: this.totalWon.toFixed(2),
      baseGameWon: this.baseGameWon.toFixed(2),
      freeSpinsWon: this.freeSpinsWon.toFixed(2),
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
      freeSpinsTriggerRate: ((this.freeSpinsTriggers / this.baseGameSpins) * 100).toFixed(2) + '%',
      freeSpinsAwarded: this.freeSpinsAwarded,
      freeSpinsRetriggers: this.freeSpinsRetriggers,
      freeSpinsTotalWin: this.freeSpinsTotalWin.toFixed(2),
      totalMultipliersAppeared: this.totalMultipliersAppeared,
      maxAccumulatedMultiplier: this.maxAccumulatedMultiplier.toFixed(2),

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
  
  // Free spins queue and state tracking
  let freeSpinsRemaining = 0;
  let accumulatedMultiplier = 1.0;
  let multiplierCount = 0;
  let baseGameSpinsCount = 0;

  console.log('Running simulation...\n');
  console.log('💡 This test will play through ALL free spins to calculate TRUE TOTAL RTP\n');

  for (let i = 0; i < TEST_CONFIG.totalSpins || freeSpinsRemaining > 0; i++) {
    const spinStart = Date.now();
    
    // Determine if we're in free spins mode
    const isFreeSpinMode = freeSpinsRemaining > 0;
    
    // Only count base game spins toward total
    if (!isFreeSpinMode) {
      baseGameSpinsCount++;
      if (baseGameSpinsCount > TEST_CONFIG.totalSpins) {
        break; // Stop once we've completed requested base game spins (free spins will finish)
      }
    }

    try {
      // Run spin (base game or free spin)
      const spinResult = await gameEngine.processCompleteSpin({
        betAmount: TEST_CONFIG.betAmount,
        freeSpinsActive: isFreeSpinMode,
        accumulatedMultiplier: accumulatedMultiplier,
        multiplierCount: multiplierCount,
        quickSpinMode: false
      });

      // Record statistics
      stats.recordSpin(spinResult, TEST_CONFIG.betAmount, isFreeSpinMode);

      // Check if free spins triggered
      if (spinResult.bonusFeatures?.freeSpinsAwarded) {
        const awarded = spinResult.bonusFeatures.freeSpinsAwarded;
        freeSpinsRemaining += awarded;
        
        if (!isFreeSpinMode) {
          // New trigger from base game
          accumulatedMultiplier = 1.0;
          if (TEST_CONFIG.enableDetailedLogging) {
            console.log(`\n🎰 Free spins triggered! Adding ${awarded} spins (Total remaining: ${freeSpinsRemaining})`);
          }
        } else {
          // Retrigger during free spins
          if (TEST_CONFIG.enableDetailedLogging) {
            console.log(`\n🔄 Free spins RETRIGGER! Adding ${awarded} spins (Total remaining: ${freeSpinsRemaining})`);
          }
        }
      }
      
      // Update accumulated multiplier and count during free spins
      if (isFreeSpinMode && spinResult.newAccumulatedMultiplier) {
        accumulatedMultiplier = spinResult.newAccumulatedMultiplier;
        multiplierCount = spinResult.newMultiplierCount || multiplierCount;
      }
      
      // Consume free spin
      if (isFreeSpinMode) {
        freeSpinsRemaining--;
        stats.freeSpinsPlayed++;
        
        if (freeSpinsRemaining === 0) {
          accumulatedMultiplier = 1.0; // Reset after free spins end
          stats.totalMultipliersAppeared += multiplierCount;
          multiplierCount = 0; // Reset count for next free spins session
          if (TEST_CONFIG.enableDetailedLogging) {
            console.log('\n✅ Free spins round completed!\n');
          }
        }
      }

      // Track processing time
      const spinTime = Date.now() - spinStart;
      totalProcessingTime += spinTime;

      // Progress reporting (only for base game spins)
      if (TEST_CONFIG.enableProgressBar && !isFreeSpinMode && baseGameSpinsCount % 100 === 0) {
        drawProgressBar(baseGameSpinsCount, TEST_CONFIG.totalSpins);
      }

      if (TEST_CONFIG.enableDetailedLogging && baseGameSpinsCount % TEST_CONFIG.reportInterval === 0 && !isFreeSpinMode) {
        const currentRTP = stats.calculateRTP();
        console.log(`\n  Spins: ${baseGameSpinsCount} | Current RTP: ${currentRTP.toFixed(2)}% | Wins: ${stats.winningSpins} | Free Spins: ${stats.freeSpinsPlayed}`);
      }

    } catch (error) {
      console.error(`\n❌ Error on spin ${i + 1} (${isFreeSpinMode ? 'FREE' : 'BASE'}):`, error.message);
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
  console.log(`  Total Awarded:         ${report.freeSpinsAwarded.toLocaleString()}`);
  console.log(`  Free Spins Played:     ${report.freeSpinsPlayed.toLocaleString()}`);
  console.log(`  Free Spins Retriggers: ${report.freeSpinsRetriggers.toLocaleString()}`);
  console.log(`  Free Spins Total Win:  $${report.freeSpinsTotalWin}`);
  console.log(`  Multipliers Appeared:  ${report.totalMultipliersAppeared.toLocaleString()} (in free spins)`);
  console.log(`  Max Accumulated Mult:  ${report.maxAccumulatedMultiplier}x\n`);

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

