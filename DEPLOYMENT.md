# Sundari Care Deployment Guide

## Current Deployment Mode

The app currently runs on a dependency-free Node.js server and persists data in `data/db.json`.

This is good for demos and controlled local testing. For real clinic use, deploy with PostgreSQL before entering real patient data.

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

## PostgreSQL Setup

Create a database, then run:

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
```

Next backend step:
- Add `pg` driver
- Create a repository layer
- Switch API reads/writes from `data/db.json` to PostgreSQL when `DATABASE_URL` is present

## Production Checklist

- Use HTTPS
- Change all demo passwords
- Configure automatic database backups
- Keep `SESSION_SECRET` private
- Restrict server access to trusted staff
- Keep audit logs enabled
- Test prescription and billing print format on clinic printers
