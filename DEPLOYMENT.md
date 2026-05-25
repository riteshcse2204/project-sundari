# Sundari Care Deployment Guide

## Current Deployment Mode

The app runs on a Node.js server. In local development it persists data in `data/db.json`.

For Render or any production host, set `DATABASE_URL` so the app persists data in PostgreSQL. Without PostgreSQL, Render's normal filesystem can lose runtime file changes after restart or redeploy.

## Local Run

```bash
npm run dev
```

Open:

```text
http://localhost:4174
```

Health check:

```text
http://localhost:4174/api/health
```

## Docker

```bash
docker build -t sundari-care .
docker run -p 4174:4174 --env-file .env sundari-care
```

## Render PostgreSQL Setup

1. Create a Render PostgreSQL database.
2. Copy its internal database URL.
3. Open the Sundari Care web service on Render.
4. Add an environment variable:

```text
DATABASE_URL=postgresql://...
```

5. Redeploy the web service.

On first startup, the server creates the `app_state` table automatically and copies the current `data/db.json` seed into PostgreSQL.

Optional manual schema command:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

Health check should show:

```json
{"storage":"postgresql"}
```

## Daily Backup

For tomorrow's client handoff, use both:

- Admin `Backup` button at end of day for a quick JSON download.
- Render PostgreSQL backups/snapshots for server-side data safety.

Before entering real patient data, confirm `/api/health` reports `postgresql`.

## Production Checklist

- Use HTTPS
- Change all demo passwords
- Configure automatic database backups
- Keep `SESSION_SECRET` private
- Restrict server access to trusted staff
- Keep audit logs enabled
- Test prescription and billing print format on clinic printers
