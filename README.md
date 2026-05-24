# Sundari Care & Nursing Home

Premium clinic and nursing home management software starter.

## Current Version

This is a Phase 1 web app with a dependency-free Node.js backend and JSON database.

- Dashboard
- Secure demo login
- Server-side role permissions
- Password hash migration after login
- Session token authentication
- Atomic JSON writes for safer local persistence
- Deployment health check
- PostgreSQL schema and seed scripts
- Docker deployment files
- Admin staff user creation
- Change password flow
- Patient registration
- Doctor prescription panel
- OPD billing
- Pharmacy inventory
- Pharmacy sale with stock deduction
- IPD admission
- Financial reports
- Expense entry
- Audit log
- JSON backup download
- Prescription, receipt and pharmacy bill print previews
- Local API persistence in `data/db.json`
- Print support

## Run Locally

Start the local server:

```bash
npm run dev
```

Open:

```text
http://localhost:4174
```

Demo login:

```text
admin@sundaricare.local
demo123
```

## Deploy

This version can be deployed on any Node.js hosting:

- Vercel
- Render
- Railway
- VPS
- cPanel Node.js app

See [DEPLOYMENT.md](/Users/riteshkumar/Documents/Codex/2026-05-24/hii-mujhe-ek-apne-clinic-ke/DEPLOYMENT.md) for Docker, health check and PostgreSQL setup.

Required production improvements before real patient use:

- Connect API repository layer to PostgreSQL using `DATABASE_URL`
- Rotate demo passwords and enforce password policy
- Add HTTPS
- Add automatic backups
- Expand permission checks for every future API
- Add PDF templates for prescription and receipts

## Production Roadmap

Phase 1 hardening:
- PostgreSQL runtime adapter
- Password reset flow
- Edit/deactivate user flow
- Polished receipt and prescription PDF templates
- Input validation

Phase 2:
- Bed and ward management
- Nursing notes
- Discharge summary
- Pharmacy purchase and sale

Phase 3:
- WhatsApp/SMS
- Cloud backup
- Audit logs
- Advanced reports
# project-sundari
