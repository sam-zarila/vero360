#!/usr/bin/env node
/**
 * `next build` with `output: 'standalone'` writes a self-contained server into
 * `.next/standalone`, but it does NOT copy `public/`, `.next/static/` or the
 * local env files into it.
 *
 * When pm2 boots `.next/standalone/server.js` without those folders the HTML
 * still renders, yet every CSS/JS/image request 404s, so the page looks loaded
 * but React never hydrates and navigation dies. This script copies the missing
 * pieces after every build so the standalone server is actually servable.
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const distDir = path.join(root, '.next')
const standalone = path.join(distDir, 'standalone')

function log(message) {
  console.log(`[standalone] ${message}`)
}

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  log('output is not "standalone" (pm2 runs `next start`); nothing to copy')
  process.exit(0)
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return false
  fs.rmSync(to, { recursive: true, force: true })
  fs.cpSync(from, to, { recursive: true })
  return true
}

if (copyDir(path.join(root, 'public'), path.join(standalone, 'public'))) {
  log('copied public/')
}

if (copyDir(path.join(distDir, 'static'), path.join(standalone, '.next', 'static'))) {
  log('copied .next/static/')
}

// Next copies `.env` into the standalone folder at build time but not
// `.env.local` / `.env.production`, and the server `chdir`s into that folder
// before loading env, so mirror every local env file.
const envFiles = fs
  .readdirSync(root)
  .filter(
    name =>
      /^\.env(\.|$)/.test(name) &&
      !name.endsWith('.example') &&
      fs.statSync(path.join(root, name)).isFile(),
  )

for (const name of envFiles) {
  fs.copyFileSync(path.join(root, name), path.join(standalone, name))
}
if (envFiles.length) {
  log(`copied ${envFiles.join(', ')}`)
}

log('standalone build is ready to run')
