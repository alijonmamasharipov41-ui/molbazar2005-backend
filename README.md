# Molbazar2005 Backend

Node.js (CommonJS) API for Molbazar2005 — PostgreSQL only, production-ready.

## Setup

1. **Clone and install**

   ```bash
   cd molbazar2005-backend
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   # Edit .env: set DATABASE_URL, JWT_SECRET, PORT
   ```

3. **Database**

   Create a PostgreSQL database named `molbozor`, then run migrations:

   ```bash
   npm run migrate
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Server runs on `http://0.0.0.0:3000` (or your `PORT`).

## Quick check

```bash
curl http://localhost:3000/health
```

Expected: `{"ok":true,"name":"Molbazar2005 Backend","db":"connected"}`

## Scripts

- `npm run dev` — development with nodemon
- `npm start` — production
- `npm run migrate` — run SQL migrations

## API

- `GET /health` — health + DB check
- `POST /auth/register` — body: `{ full_name, phone, password }`
- `POST /auth/login` — body: `{ phone, password }` → returns `{ token }`
- `GET /listings` — list (newest first)
- `GET /listings/:id` — one listing
- `POST /listings` — create (JWT required)
- `DELETE /listings/:id` — delete (owner or admin, JWT required)

## VPS deploy

1. Install Node.js, PostgreSQL, PM2 on the server.
2. Clone repo, `npm install`, create `.env` with production `DATABASE_URL` and `JWT_SECRET`.
3. Run `npm run migrate`.
4. Start with PM2:

   ```bash
   pm2 start src/server.js --name molbazar2005-backend
   pm2 save
   pm2 startup
   ```

5. Use nginx (or similar) as reverse proxy with HTTPS for your API domain.
