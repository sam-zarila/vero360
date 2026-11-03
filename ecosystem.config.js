/**
 * pm2 config for the Vero360 web app (Next.js, `output: 'standalone'`).
 *
 *   npm run build          # next build + copy public/.next/static into standalone
 *   pm2 start ecosystem.config.js
 *   pm2 save               # keep the process across reboots
 *
 * The Next.js server must never share a port with vero-backend (3000), so the
 * web app defaults to 3001. Override with WEB_PORT / WEB_HOST in `.env`.
 */
const path = require('path')

const appDir = __dirname

// Load `.env` / `.env.local` exactly the way `next start` does so runtime-only
// values (Firebase admin, PawaPay, Resend…) reach the standalone server.
try {
  require(path.join(appDir, 'node_modules', '@next', 'env')).loadEnvConfig(appDir)
} catch (_) {
  // Env is optional: pm2 can also receive values from the shell / `--update-env`.
}

// Bare `HOSTNAME` is inherited from the Linux machine name in many shells and
// the standalone server reads it, which would bind to the wrong interface.
const port = process.env.WEB_PORT || process.env.PORT || '3001'
const hostname = process.env.WEB_HOST || '0.0.0.0'

module.exports = {
  apps: [
    {
      name: 'vero360web',
      cwd: appDir,
      script: '.next/standalone/server.js',
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
