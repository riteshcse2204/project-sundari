# Project Sundari Context

## Product

Sundari Care & Nursing Home is a clinic and nursing home management web app for reception, doctors, pharmacy, nursing/IPD, accounts and admin users.

## Current Stack

- Runtime: Node.js 18+
- Backend: Node HTTP server in `server.js`
- Frontend: vanilla HTML, CSS and JavaScript
- Local storage: `data/db.json`
- Production storage: PostgreSQL when `DATABASE_URL` is set
- Deployment target: Render or any Node.js host

## Run

```bash
npm run dev
```

Open:

```text
http://localhost:4174
```

Demo admin:

```text
admin@sundaricare.local
demo123
```

## Important Files

- `server.js`: HTTP server, static file serving, API routes, auth, role permissions, JSON/PostgreSQL persistence and audit logging.
- `app.js`: frontend state, API client, offline fallback, rendering, form handlers, print previews and backup download.
- `index.html`: all app views and forms.
- `styles.css`: app layout and visual styling.
- `data/db.json`: demo/local JSON database.
- `database/schema.sql`: PostgreSQL schema including `app_state` JSONB persistence.
- `database/seed.sql`: PostgreSQL seed data.
- `DEPLOYMENT.md`: local, Docker and PostgreSQL deployment notes.
- `SundariCare_Clinic_Software_Blueprint.md`: product blueprint and roadmap.

## Current Modules

- Login and session token authentication
- Role-based navigation and server-side permissions
- Dashboard with visits, revenue, due and low-stock metrics
- Patient registration and patient search
- Doctor queue and prescription entry
- OPD billing and receipt print preview
- Pharmacy medicine master
- Pharmacy sale with stock deduction and bill print preview
- IPD admission
- Expense entry
- Financial reports
- Audit log
- Admin user creation
- Change password flow
- JSON data backup download

## Backend API

- `GET /api/health`
- `GET /api/bootstrap`
- `POST /api/login`
- `POST /api/logout`
- `POST /api/users`
- `POST /api/change-password`
- `POST /api/patients`
- `POST /api/prescriptions`
- `POST /api/bills`
- `POST /api/medicines`
- `POST /api/pharmacy-sales`
- `POST /api/admissions`
- `POST /api/expenses`

## Roles

- `Admin`: full access
- `Doctor`: dashboard and prescriptions
- `Reception`: dashboard, patients, billing and IPD entry
- `Pharmacy`: dashboard and pharmacy
- `Nurse`: dashboard and IPD
- `Accountant`: dashboard, billing and reports

## Production Priorities

1. Add stronger input validation on every write route.
2. Replace demo passwords and enforce production password policy.
3. Add persistent sessions with expiry and `SESSION_SECRET`.
4. Add edit/deactivate flows for users, patients, medicines and admissions.
5. Add appointment/token flow.
6. Add bed and ward management.
7. Add polished PDF/print templates for prescriptions, receipts, pharmacy bills and discharge summaries.
8. Add automatic backups and restore flow.
9. Expand audit logging for updates and deletes.

## Notes For Future Work

- Keep changes small and compatible with the current dependency-free style unless intentionally upgrading the stack.
- Prefer adding validation and persistence boundaries before expanding feature complexity.
- Render auto-deploys only after changes are pushed to the connected GitHub branch, likely `main`.
- For production patient data, `DATABASE_URL` must be configured and `/api/health` should report `postgresql`.
