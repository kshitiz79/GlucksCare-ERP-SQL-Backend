module.exports = {
  apps : [{
    name   : "sql-backend",
    script : "./index.js",
    cwd: "./",
    instances : 1,
    exec_mode : "fork",
    env: {
      NODE_ENV: "development",
      PORT: 5051
    },
    env_production : {
      NODE_ENV: "production",
      PORT: 5051
    },
    watch: true,
    ignore_watch : ["node_modules", "logs"],
    log_file: "./logs/app.log",
    error_file: "./logs/error.log",
    out_file: "./logs/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
}