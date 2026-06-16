# CabDesign — SVG Cabinet & Outdoor Kitchen Designer

A browser-based cabinet design tool with a dealer portal. All 2D drawing is parametric SVG (no image assets), 3D is generated from the same design data with Three.js. A small Express + SQLite backend handles dealer logins, an admin panel, per-dealer pricing preferences, and saved customer jobs.

## Run it

```bash
npm install            # first time only
npm run import-dealers # first time only — seed dealers from importdealers.txt
npm run dev            # starts BOTH the Vite app (:5173) and the API (:4000)
```

Open the printed `localhost:5173` URL and sign in.

- **First admin login:** the import makes `extcabinets@gmail.com` the admin (it was the only non-"Dealer" account). Imported dealers keep their existing passwords. To set a known password for any account:
  ```bash
  npm run set-password -- extcabinets@gmail.com YourPassword
  ```

Other scripts: `npm run dev:web` / `npm run dev:server` run the two halves separately; `npm run server` runs just the API.

## The dealer portal

- **Sign in** — every user logs in with email + password (JWT session cookie). Two roles: `admin` and `dealer`.
- **Admin → Dealers** — add / edit / enable-disable / delete dealers and reset their passwords (admin only).
- **Admin → Cabinet size limits & Base pricing** — global min/max width/depth per cabinet and the base box pricing formulas (the dealer's *cost*). "Save for all dealers" pushes them to the server. (These are the existing Settings/Pricing modals, now admin-controlled and shared.)
- **Profile** (each dealer) — upload a **company logo** (shown on their customer reports), set their profit **margin %**, whether to **show or hide pricing** on the report, and whether the report shows **their cost** or **marked-up** prices. Also change password.
- **My Jobs** (each dealer) — save the current design with the customer's **name, email, and address**, then reopen, rename, or delete saved jobs later. (File **Export/Import** still works as a local backup.)

## Production build & hosting

`npm run build` compiles the SPA into `dist/`. Because there is now a backend, host it as a small Node service rather than a pure static site:

```bash
npm run build
NODE_ENV=production JWT_SECRET=<random-secret> npm run server   # serves API + dist/ on one origin
```

The Express server auto-serves `dist/` when present, so the SPA and API share an origin (cookies just work). Configure via env vars: `PORT`, `JWT_SECRET` (**required in prod**), `DB_PATH`, `SESSION_DAYS`, `CORS_ORIGIN`. The SQLite database lives at `server/data/cabdesign.db` (gitignored) — back it up to keep dealers and jobs. Hosts like Railway / Render / Fly run this directly; a persistent disk is needed for the SQLite file.

## Features

- **Walls tab** — one elevation card per wall. `+ Add` opens the catalog (base, wall, tall, outdoor grill/griddle/side-burner cabinets, and visual appliances) with isometric previews. Drag cabinets to move them (snaps to neighbors and wall ends), click one to edit width/depth/height/outset and hinge side with steppers, duplicate, or remove. Wall length/height are editable per wall; segment + overall dimensions update live. Hatched "corner" zones appear automatically where another wall's cabinets occupy the corner — only corner cabinets (lazy susan, blind corner) may enter them.
- **Top View tab** — plan view with countertop runs, appliance symbols, item callout numbers, and wall dimensions. Cabinets drag along their wall here too. The **Draw wall** tool lets you draw walls anywhere (galley/L/U/custom; angles snap to 45°, ends snap to other walls), walls drag to reposition, and one-click auto-arrange presets handle the classic shapes.
- **3D tab** — orbitable rendering with shadows, generated from the design. "Save view to report" captures the current camera angle for the report cover.
- **Report tab** — print-ready design report: cover with 3D rendering, dimensioned floor plan, lettered elevations with callouts, and an item schedule with prices. "Print / Save as PDF" uses the browser's PDF export.
- **Report tab** also honors the signed-in dealer's pricing preferences (hide pricing entirely, or show cost vs. marked-up prices).
- **Pricing** (admin) — per-cabinet-type base price formulas using `W`, `D`, `H` in inches (e.g. `150 + 9.5*W + 2*D`). Set by the admin and shared with all dealers as their cost basis.
- **Save job / Open** — designs save to the dealer's account with customer details (see **My Jobs**); `.cabdesign.json` export/import still works as a local backup, and work autosaves to the browser.

## Code map

| Path | What it is |
| --- | --- |
| `src/model/catalog.ts` | Cabinet catalog (sizes, ranges, default price formulas) and finishes — add new cabinet types here |
| `src/model/pricing.ts` | Safe formula parser/evaluator (no `eval`) |
| `src/model/geometry.ts` | Plan-view wall layout math (linear / L / U) |
| `src/state/store.ts` | Zustand store: design state, drag re-packing, persistence |
| `src/components/svg.tsx` | Parametric SVG cabinet fronts, plan symbols, dimension lines |
| `src/components/WallsView.tsx` | Elevation cards with drag & drop |
| `src/components/TopView.tsx` | Plan view |
| `src/components/View3D.tsx` | Three.js scene builder + snapshot |
| `src/components/Report.tsx` | Printable report pages (honors each dealer's show/hide + cost-vs-markup prefs) |
| `src/state/session.ts` | Auth/session store: login, current screen, loads admin globals into the designer |
| `src/api/client.ts` | Typed `fetch` client for the backend API |
| `src/components/Login.tsx` · `AdminPanel.tsx` · `ProfileScreen.tsx` · `JobsScreen.tsx` · `SaveJobModal.tsx` | Portal screens |
| `server/index.ts` | Express app — mounts the API and serves `dist/` in production |
| `server/db.ts` · `schema.sql` | SQLite connection + tables (users, dealer_prefs, jobs, app_settings) |
| `server/auth.ts` | bcrypt password hashing + JWT session cookie + route guards |
| `server/routes/*.ts` | `auth`, `dealers` (admin), `settings` (global dims + pricing), `profile`, `jobs` |
| `server/import-dealers.ts` · `set-password.ts` | One-off CLIs: seed dealers, set a password |
