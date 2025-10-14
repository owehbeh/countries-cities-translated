module.exports = {
  apps: [
    {
      name: 'countries-cities-api',
      script: 'src/server.js',
      instances: 12,
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
