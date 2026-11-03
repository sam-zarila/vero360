/**
 * pm2 config for the Vero360 web app.
 *
 *   npm ci
 *   npm run build
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *
 * `next start` serves the build from `.next` + `public/` in this folder, so no
 * `output: 'standalone'` is required. (The build hook still prepares
 * `.next/standalone` if that output mode is ever re-enabled.)
 *
 * Port: vero-backend already owns 3000, so the web app defaults to 3001.
 * Override with WEB_PORT / WEB_HOST in `.env`.
 */
const path = require('path')

const appDir = __dirname

// Load `.env` / `.env.local` the way `next start` does, so server-only values
// (Firebase admin, PawaPay, Resend…) reach the process.
try {
  require(path.join(appDir, 'node_modules', '@next', 'env')).loadEnvConfig(appDir)
} catch (_) {
  // Env is optional: pm2 can also receive values from the shell / `--update-env`.
}

// Port: vero-backend owns 3000, so never inherit a generic `PORT` from `.env`
// (a stray PORT=3000 there would make Next fight the backend for the socket).
const port = process.env.WEB_PORT || '3001'
const hostname = process.env.WEB_HOST || '0.0.0.0'

module.exports = {
  apps: [
    {
      name: 'vero360web',
      cwd: appDir,
      // Run Next's CLI directly instead of `pm2 start npm -- start`: no npm
      // wrapper process, and env changes apply cleanly on `--update-env`.
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '700M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: port,
        HOSTNAME: hostname,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
