# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Site Inventory Management System** — A full-stack web app for managing construction site materials: stock tracking, material requests, issue/return workflows, and PDF delivery notes.

## Architecture

Monorepo with two separate apps:

```
site-inventory/
├── server/   # Node.js + Express REST API (port 4000)
└── client/   # React + Vite SPA (port 5173)
```

### Backend (`server/`)

- **Framework**: Express.js
- **Database**: PostgreSQL (`site_inventory` DB) via `pg`
- **Auth**: JWT (Bearer token in `Authorization` header OR `?token=` query param for PDF downloads)
- **Entry point**: `src/index.js`
- **Pattern**: Routes → Controllers → DB queries (no ORM)

Key directories:
- `src/routes/` — Express routers, role guards applied here
- `src/controllers/` — Business logic
- `src/middleware/auth.js` — JWT verification (supports both header and `?token=` query param)
- `src/middleware/role.js` — Role-based access: `role('admin', 'superuser')`
- `src/db/migrations/` — Sequential SQL migrations (run in filename order)
- `src/services/pdf.service.js` — PDFKit delivery note generation
- `src/services/excel.service.js` — Excel packing list upload parser
- `src/jobs/dailyReport.job.js` — node-cron daily report job

### Frontend (`client/`)

- **Framework**: React 19 + Vite + Tailwind CSS
- **Routing**: React Router v7
- **HTTP**: Axios via `src/utils/axiosInstance.js` (auto-attaches Bearer token, redirects to `/login` on 401)
- **Auth state**: `src/context/AuthContext.jsx` — stores user + token in `localStorage`, refreshes via `/auth/me` on startup

Role-based page structure:
```
src/pages/
├── admin/       — admin role
├── requester/   — requester role
├── storekeeper/ — storekeeper role
├── superuser/   — superuser role
└── coordinator/ — coordinator role
```

Each role group has its own dashboard and protected routes (`ProtectedRoute` component enforces role).

## Roles & Permissions

| Role | Can Do |
|---|---|
| `admin` | Full access — users, projects, settings |
| `superuser` | Upload packing lists, reports, projects |
| `storekeeper` | See assigned projects only, issue material, manage returns |
| `requester` | Submit requests, view own requests |
| `coordinator` | Resolve escalations |

`admin` and `superuser` are also allowed on storekeeper/requester API routes for testing.

Storekeepers are scoped to their assigned projects via `project_storekeepers` table.

## Running the Project

### Server
```bash
cd server
npm run dev        # nodemon watch mode
npm run migrate    # run all SQL migrations in order
npm run seed       # create default admin user
```

### Client
```bash
cd client
npm run dev        # Vite dev server on port 5173
npm run build      # production build
npm run lint       # ESLint
```

### Environment (`server/.env`)
```
DATABASE_URL=postgresql://localhost/site_inventory
JWT_SECRET=site_inventory_super_secret_jwt_key_2026
JWT_EXPIRES_IN=8h
PORT=4000
FRONTEND_URL=http://localhost:5173
```

## Database

- PostgreSQL database: `site_inventory`
- Migrations are plain SQL files run sequentially — add new ones as `014_...sql`, `015_...sql`
- No migration tracking table — migrations use `IF NOT EXISTS` / `ON CONFLICT` so they are safe to re-run
- **WARNING**: Re-running the seed resets the admin password but does NOT reset other users' roles

Default admin credentials:
- Employee ID: `73106302`
- Password: `Admin@1234`

Other accounts (password: `Pass@1234`):
- `waled` — storekeeper (must be assigned to a project via `project_storekeepers`)
- `2250` — requester (hassan)
- `2240` — superuser (hassan1)

## Key Data Flow

**Material Request → Issue → Return:**
1. Requester submits request (`material_requests` + `request_items`)
2. Storekeeper issues material → `material_issues` + `issue_items`, updates `stock_items.qty_on_hand`
3. PDF delivery note auto-generated to `server/uploads/delivery-notes/DN-*.pdf`
4. Returns tracked in `material_returns`

**Stock Upload:**
- Superuser uploads `.xlsx` packing list via `/superuser/upload`
- `excel.service.js` parses and matches project by name/number (fuzzy match)
- Confirm step upserts into `stock_items` via `ON CONFLICT (project_id, item_number)`

Expected Excel column headers (exact match):
`PROJECT NAME`, `Y3#`, `CATEGORY`, `ITEM NUMBER`, `ITEM DESCRIPTION`, `DESCRIPTION LINE 2`, `UOM`, `Project Onhand`, `Container No.`, `Issued Quantity`, `ID issued by`, `Received By`, `Returned Quantity`, `Pending Return QTY`

## Common Issues

**"Forbidden" on API calls**: User's JWT token has wrong role. Cause: role was changed in DB after last login. Fix: log out and log back in to get a fresh token.

**Storekeeper sees no stock**: Storekeeper must be assigned to a project in `project_storekeepers`. Check with:
```sql
SELECT * FROM project_storekeepers WHERE user_id = '<user-id>';
```

**All roles reset to `requester`**: Can happen if a migration or seed is re-run. Fix:
```sql
UPDATE users SET role='admin' WHERE employee_id='73106302';
UPDATE users SET role='storekeeper' WHERE employee_id='waled';
UPDATE users SET role='superuser' WHERE employee_id='2240';
```
