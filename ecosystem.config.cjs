module.exports = {
  apps: [
    {
      name: "birthday-bot",
      script: "./index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true,
      watch: false,
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
