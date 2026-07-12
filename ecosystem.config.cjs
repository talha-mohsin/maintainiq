/**
 * MaintainIQ — PM2 Ecosystem Configuration
 * AWS EC2 Production Process Manager
 * Run: pm2 start ecosystem.config.cjs
 */

module.exports = {
  apps: [
    {
      name: 'maintainiq',
      script: './backend/dist/server.js',

      // Cluster mode: spawn one process per CPU core
      instances: 'max',
      exec_mode: 'cluster',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Auto-restart configuration
      watch: false,
      ignore_watch: ['node_modules', 'frontend', '*.log'],
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,

      // Memory management: restart if heap exceeds 512MB
      max_memory_restart: '512M',

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/pm2/maintainiq-error.log',
      out_file: '/var/log/pm2/maintainiq-out.log',
      merge_logs: true,

      // Zero-downtime reload
      exp_backoff_restart_delay: 100,
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: process.env.EC2_HOST || 'YOUR_EC2_IP',
      ref: 'origin/main',
      repo: 'git@github.com:talha-mohsin/final-hackathon.git',
      path: '/home/ubuntu/maintainiq',
      'post-deploy': 'npm ci --omit=dev && npm run build && pm2 reload ecosystem.config.cjs --env production',
    }
  }
};
