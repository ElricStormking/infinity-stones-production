#!/usr/bin/env node

/**
 * MCP Demo Queries - Working Examples
 *
 * This file contains working examples of MCP database interactions
 * that can be used once Supabase is running.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * MCP Query Examples - These demonstrate what Claude AI can do with natural language
 */
const MCPExamples = {

  // Example 1: Player Statistics
  async getPlayerStatistics() {
    console.log('🎮 MCP Example: "Show me player statistics"');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, balance, created_at, active')
        .eq('active', true)
        .order('balance', { ascending: false })
        .limit(10);

      if (error) {throw error;}

      console.log('📊 Top Players by Balance:');
      data.forEach((player, index) => {
        console.log(`   ${index + 1}. ${player.username}: $${player.balance}`);
      });

      return data;
    } catch (error) {
      console.log(`   ❌ Query failed: ${error.message}`);
      console.log('   💡 This will work once Supabase is running');
      return null;
    }
  },

  // Example 2: Game Analytics
  async getGameAnalytics() {
    console.log('\n🎰 MCP Example: "Calculate our RTP and show recent activity"');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      // RTP Calculation
      const { data: rtpData, error: rtpError } = await supabase
        .rpc('calculate_rtp');

      if (rtpError) {
        // Fallback to manual calculation
        const { data: spins, error } = await supabase
          .from('spins')
          .select('bet_amount, total_win');

        if (error) {throw error;}

        const totalBets = spins.reduce((sum, spin) => sum + parseFloat(spin.bet_amount), 0);
        const totalWins = spins.reduce((sum, spin) => sum + parseFloat(spin.total_win), 0);
        const rtp = totalBets > 0 ? (totalWins / totalBets) * 100 : 0;

        console.log(`📈 Current RTP: ${rtp.toFixed(2)}% (Target: 96.5%)`);
        console.log(`💰 Total Bets: $${totalBets.toFixed(2)}`);
        console.log(`🎯 Total Wins: $${totalWins.toFixed(2)}`);

        return { rtp, totalBets, totalWins, spinCount: spins.length };
      }

    } catch (error) {
      console.log(`   ❌ Analytics query failed: ${error.message}`);
      console.log('   💡 This will work once Supabase is running');
      return null;
    }
  },

  // Example 3: Fraud Detection
  async findAnomalousWins() {
    console.log('\n🚨 MCP Example: "Find any suspicious winning patterns"');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      const { data, error } = await supabase
        .from('spins')
        .select('spin_id, player_id, bet_amount, total_win, created_at')
        .gt('total_win', 0)
        .order('total_win', { ascending: false })
        .limit(20);

      if (error) {throw error;}

      console.log('🔍 Highest Wins (Potential Review):');
      data.forEach((spin, index) => {
        const multiplier = spin.total_win / spin.bet_amount;
        const flag = multiplier > 100 ? '🚨' : multiplier > 50 ? '⚠️' : '✅';
        console.log(`   ${index + 1}. ${flag} ${spin.spin_id}: $${spin.bet_amount} → $${spin.total_win} (${multiplier.toFixed(1)}x)`);
      });

      return data;
    } catch (error) {
      console.log(`   ❌ Fraud detection query failed: ${error.message}`);
      console.log('   💡 This will work once Supabase is running');
      return null;
    }
  },

  // Example 4: Revenue Analysis
  async getDailyRevenue() {
    console.log('\n📊 MCP Example: "Show me daily revenue for the last week"');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      const { data, error } = await supabase
        .from('spins')
        .select('created_at, bet_amount, total_win')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {throw error;}

      // Group by day
      const dailyStats = {};
      data.forEach(spin => {
        const day = spin.created_at.split('T')[0];
        if (!dailyStats[day]) {
          dailyStats[day] = { bets: 0, wins: 0, spins: 0 };
        }
        dailyStats[day].bets += parseFloat(spin.bet_amount);
        dailyStats[day].wins += parseFloat(spin.total_win);
        dailyStats[day].spins += 1;
      });

      console.log('📅 Daily Revenue Report:');
      Object.entries(dailyStats)
        .sort(([a], [b]) => b.localeCompare(a))
        .forEach(([day, stats]) => {
          const profit = stats.bets - stats.wins;
          const rtp = stats.bets > 0 ? (stats.wins / stats.bets * 100) : 0;
          console.log(`   ${day}: ${stats.spins} spins, $${stats.bets.toFixed(2)} bets, $${stats.wins.toFixed(2)} wins, $${profit.toFixed(2)} profit (${rtp.toFixed(1)}% RTP)`);
        });

      return dailyStats;
    } catch (error) {
      console.log(`   ❌ Revenue analysis failed: ${error.message}`);
      console.log('   💡 This will work once Supabase is running');
      return null;
    }
  },

  // Example 5: System Health
  async checkSystemHealth() {
    console.log('\n🏥 MCP Example: "Give me a system health report"');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      // Check table sizes
      const tables = ['users', 'spins', 'game_sessions', 'cascade_steps', 'transaction_logs'];
      const tableStats = {};

      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          tableStats[table] = count;
        }
      }

      console.log('📋 Database Table Sizes:');
      Object.entries(tableStats).forEach(([table, count]) => {
        console.log(`   ${table}: ${count} records`);
      });

      // Check recent activity
      const { data: recentSpins, error } = await supabase
        .from('spins')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && recentSpins.length > 0) {
        console.log(`🕐 Last Activity: ${recentSpins[0].created_at}`);
      }

      return { tableStats, lastActivity: recentSpins?.[0]?.created_at };
    } catch (error) {
      console.log(`   ❌ Health check failed: ${error.message}`);
      console.log('   💡 This will work once Supabase is running');
      return null;
    }
  }
};

/**
 * Demo Runner - Shows what MCP can do
 */
async function runMCPDemo() {
  console.log('🚀 MCP Database Interaction Demo');
  console.log('=' .repeat(50));
  console.log('These examples show what Claude AI can do with natural language database queries\n');

  // Run all examples
  const examples = [
    MCPExamples.getPlayerStatistics,
    MCPExamples.getGameAnalytics,
    MCPExamples.findAnomalousWins,
    MCPExamples.getDailyRevenue,
    MCPExamples.checkSystemHealth
  ];

  for (const example of examples) {
    await example();
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎯 MCP Integration Summary');
  console.log('='.repeat(50));
  console.log('✅ All query patterns are ready for Claude AI');
  console.log('📚 Natural language queries will work once database is connected');
  console.log('🔧 Start Supabase: supabase start');
  console.log('💬 Then ask Claude: "Show me player statistics" or any natural language query');

  console.log('\n🚀 Ready for Development!');
  console.log('You can now use Claude AI to interact with the database using plain English.');
}

// Export for use
module.exports = MCPExamples;

// Run demo if called directly
if (require.main === module) {
  runMCPDemo().catch(console.error);
}