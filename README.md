# CampusCare Backend

CampusCare is a university maintenance management system for Dire Dawa University. This NestJS REST API stores requests in PostgreSQL through Prisma ORM 7.

## Requirements

- Node.js 24 or compatible with the installed NestJS and Prisma versions
- PostgreSQL 18
- `campuscare_db` and `campuscare_shadow` databases owned by `campuscare_app`

## Environment

The backend reads `.env` from this directory. `.env` is ignored by Git; never commit database credentials. Use [.env.example](.env.example) as a template when setting up another development machine. The shadow database must already exist and be accessible to the application user; the app user does not need `CREATEDB`.

The required values are:

- `DATABASE_URL` for `campuscare_db`
- `SHADOW_DATABASE_URL` for `campuscare_shadow`
- `PORT` (defaults to `3001`)
- `FRONTEND_ORIGIN` (defaults to `http://localhost:3000`)

## Install and run

Run these commands from `C:\Users\siso\campuscare-backend` in PowerShell.

```powershell
npm.cmd install
```

```powershell
npm.cmd run prisma:generate
```

Apply any pending development migrations:

```powershell
.\node_modules\.bin\prisma.cmd migrate dev --config prisma7.config.ts
```

Start the backend in watch mode:

```powershell
npm.cmd run start:dev
```

The default API address is `http://localhost:3001/api`. The database-backed health check is `GET /api/health`.

## Maintenance request endpoints

- `GET /api/maintenance-requests` — paginated list with `search`, `status`, `priority`, `category`, `sortBy`, and `sortOrder` filters
- `GET /api/maintenance-requests/:id` — request details
- `GET /api/maintenance-requests/summary` — database counts for the dashboard
- `POST /api/maintenance-requests` — submit a request

The request body accepts `title`, `description`, `category`, `location`, and optional `priority`. Category, priority, and status values use uppercase enum names such as `WATER_SUPPLY`, `HIGH`, and `PENDING`. IDs, timestamps, and status are generated or controlled by the backend. Image upload is not implemented.

Request updates, status changes, deletion, and authentication are not exposed yet. Those operations require the authentication and role checks described in the project roadmap.

## Verification

```powershell
npm.cmd run build
```

```powershell
npm.cmd test -- --runInBand
```

```powershell
npm.cmd run test:e2e -- --runInBand
```

```powershell
npm.cmd run lint
```

Prisma schema and migration commands use `prisma7.config.ts`; keep that filename when running the CLI.
