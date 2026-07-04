# CloudNSofts

Full-stack TypeScript starter with **end-to-end type safety**.

- **`frontend/`** — Next.js (App Router) + TypeScript
- **`backend/`** — Node.js + Express + TypeScript
- **`shared/`** — Types & Zod schemas imported by both sides (single source of truth)

Wired together with **npm workspaces**. Currently a blank skeleton — build from here.

## Requirements

- Node.js >= 20
- npm >= 10

## Getting started

```bash
npm install     # install all workspaces
npm run dev     # build shared, then run backend (:4000) + frontend (:3000)
```

Open <http://localhost:3000>. The backend exposes `GET /health`.

### Run individually

```bash
npm run build:shared   # build shared types (needed before either app)
npm run dev:backend    # Express API on :4000
npm run dev:frontend   # Next.js on :3000
```

## Scripts (from repo root)

| Command             | Description                                |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Build shared, then run backend + frontend  |
| `npm run build`     | Production build of all three packages     |
| `npm run typecheck` | Type-check every workspace                 |

## Where to build

- Add shared models to [`shared/src/index.ts`](shared/src/index.ts) (Zod schema + `z.infer` type).
- Add API routes in [`backend/src/index.ts`](backend/src/index.ts).
- Add pages/components under [`frontend/src/app/`](frontend/src/app/).
