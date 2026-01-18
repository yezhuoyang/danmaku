// PM2 Ecosystem Configuration for PaperPilot
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'paperpilot',
      script: 'dist/index.js',
      cwd: '/var/www/paperpilot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '.env',
      error_file: '/var/log/paperpilot/error.log',
      out_file: '/var/log/paperpilot/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
