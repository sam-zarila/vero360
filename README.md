# vero360app

[![Netlify Status](https://api.netlify.com/api/v1/badges/900a1995-8740-4da6-a64c-ab05f66ae9ba/deploy-status)](https://app.netlify.com/projects/celebrated-kangaroo-455237/deploys)

Marketing website for **Vero360** - Malawi's all-in-one super app for marketplace, Vero Ride, courier, food, accommodation, jobs, and more.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build (also prepares `.next/standalone`)
- `npm run start` - run production server with `next start`
- `npm run start:prod` - run the standalone production server
- `npm run deploy` - build and (re)start the pm2 process
- `npm run lint` - run ESLint

## Running on pm2

```bash
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
```

The ecosystem runs Next's own CLI (`next start`) from this folder, so it serves
`.next/` + `public/` directly. If `output: 'standalone'` is enabled in
`next.config.ts` again, `npm run build` copies `public/`, `.next/static/` and the
local `.env*` files into `.next/standalone` (without that the standalone server
renders HTML but 404s every asset, so React never hydrates).

Useful commands: `pm2 logs vero360web`, `pm2 reload ecosystem.config.js --update-env`,
`npm run deploy` (build + reload).

### Ports

`vero-backend` already owns port **3000**, so the web app binds **3001**.
Set `WEB_PORT` in `.env` to change it (`WEB_HOST`, default `0.0.0.0`, controls the
interface). Never start the web app on 3000 — it fails with `EADDRINUSE` and pm2
restarts it forever.

### Always serve over HTTPS

`crypto.randomUUID`, `navigator.clipboard`, `navigator.share` and
`navigator.geolocation` only exist in a **secure context** (HTTPS or `localhost`).
Served over plain HTTP — for example while testing by IP — any unguarded call to
them throws and takes the whole page down with Next's "This page couldn't load"
screen. Client code must use `randomId()` from `@/lib/random-id` instead of
`crypto.randomUUID()`. Terminate TLS in nginx and proxy to the app.

### Hosts

A single-server deployment serves the public site and the `/dashboard` panel from
the same host; the middleware decides the surface from the path instead of
redirecting between hosts. Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_ADMIN_URL`
to the origin users actually open (for example `https://vero360.app`) and rebuild:
both are baked into the client bundle at build time.

Only set `NEXT_PUBLIC_ADMIN_URL` to a separate host (e.g. `https://admin.vero360.app`)
once that hostname points at this server — otherwise `/dashboard` redirects to an
address that cannot be reached.

### Reverse proxy

When nginx (or Caddy) fronts the app, forward the host so the public/admin checks
see the browser's hostname:

```nginx
proxy_pass http://127.0.0.1:3001;
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

