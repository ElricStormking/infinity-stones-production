/**
 * PM2 Ecosystem Configuration for Infinity Storm
 *
 * Manages production deployment with:
 * - Process clustering for high availability
 * - Auto-restart on failure
 * - Log management and rotation
 * - Environment-specific configurations
 * - Health monitoring
 */

module.exports = {
  apps: [
    {
      name: 'infinity-storm',
      script: './server.js',
      cwd: '/var/www/infinity-storm/infinity-storm-server',

      // Process Management
      instances: 'max',  // Use all CPU cores
      exec_mode: 'cluster',  // Cluster mode for load balancing
      watch: false,  // Disable in production (use for dev)

      // Auto-restart Configuration
      max_memory_restart: '1G',  // Restart if memory exceeds 1GB
      min_uptime: '10s',  // Minimum uptime before considering successful
      max_restarts: 10,  // Max restart attempts
      autorestart: true,  // Auto-restart on crash

      // Logging
      error_file: '/var/log/infinity-storm/pm2-error.log',
      out_file: '/var/log/infinity-storm/pm2-out.log',
      log_file: '/var/log/infinity-storm/pm2-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Environment Variables
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080
        // Other env vars should be in .env file or system environment
      },

      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8081
      },

      env_development: {
        NODE_ENV: 'development',
        PORT: 3001
      },

      // Health Monitoring
      kill_timeout: 5000,  // Time to wait before force killing (ms)
      listen_timeout: 3000,  // Time to wait for app to be ready (ms)
      shutdown_with_message: false,

      // Process Options
      cron_restart: '0 3 * * *',  // Restart daily at 3 AM (optional)

      // Advanced Options
      node_args: '--max-old-space-size=2048',  // 2GB max heap size
      source_map_support: true,
      ignore_watch: ['node_modules', 'logs', '*.log'],

      // Graceful Shutdown
      wait_ready: true
    }
  ],

  // Deployment Configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/infinity-storm.git',
      path: '/var/www/infinity-storm',
      'post-deploy': 'cd infinity-storm-server && npm ci --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'sudo mkdir -p /var/www/infinity-storm && sudo chown deploy:deploy /var/www/infinity-storm'
    },

    staging: {
      user: 'deploy',
      host: 'your-staging-server.com',
      ref: 'origin/staging',
      repo: 'git@github.com:yourusername/infinity-storm.git',
      path: '/var/www/infinity-storm-staging',
      'post-deploy': 'cd infinity-storm-server && npm ci && pm2 reload ecosystem.config.js --env staging'
    }
  }
};









