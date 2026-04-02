<<<<<<< HEAD
# AFL Performance App

React + Vite + TypeScript frontend with RBAC for `admin`, `manager`, and `player`.

## Run

1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Run tests:
   - `npm run test`

## Environment

- `VITE_GOOGLE_SHEETS_API_KEY`: key used by the frontend to read live Google Sheets data directly.
- `VITE_GOOGLE_SHEET_ID` (optional): defaults to `1MP0mzEPAxo-Z9g0lmcipxLepjap6Vu3FSCXhbzaRpSU`.
- `VITE_API_BASE_URL` (optional): if set, frontend calls your backend `/api/sheets/snapshot`; if not set, it reads Google Sheets directly.
- `GOOGLE_SHEETS_API_KEY` (optional backend mode): used by `/api/sheets/snapshot` when you deploy serverless handlers.

Create a local env file before running:

1. Copy `.env.example` to `.env.local`
2. Set your Google Sheets API key in `.env.local`
3. Keep `.env.local` private and never commit it

Tabs read from Sheets API:
  - `Input Sheet AFL`
  - `Impact Score AFL` (with alias support for `Inpact Score AFL`)
  - `CategoryScores`

## Routes

- `/login`
- `/manager/dashboard` (admin, manager)
- `/player/:playerId` (admin, manager, matching player)
- `/admin/users`, `/admin/roles`, `/admin/settings`, `/admin/audit` (admin only)

## API Endpoints

- `GET /api/sheets/snapshot`
- `GET /api/users/me`
- `GET/POST/PATCH /api/admin/users`
- `GET/POST/PATCH /api/admin/roles`
- `GET/PATCH /api/admin/settings`
- `GET /api/admin/audit`
=======
# team-performance
Team Performance
>>>>>>> 44821f16738b15a2abc1b2e72b65916c5ebf785e
