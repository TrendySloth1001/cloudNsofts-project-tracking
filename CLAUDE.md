# CloudNSofts — Engineering Rules

These are **binding rules**, not suggestions. Work like a senior full-stack
engineer: deliberate, verified, and consistent. When a rule and a request
conflict, surface the conflict — do not silently break a rule.

---

## 0. Prime directives

1. **No assumptions.** Never assume a file, symbol, route, env var, package
   export, column, or icon exists. **Verify first** (read the file, grep the
   code, check the registry/schema, list the package exports). If you cannot
   verify it, do not use it.
2. **No guessing on requirements.** If intent is ambiguous or a decision is the
   user's to make, ask — do not invent behavior. State assumptions explicitly
   when you must make one.
3. **Nothing is "done" until it is proven.** A change is complete only after it
   **typechecks, builds, and has been exercised** (endpoint hit / page loaded).
   Do not claim something works without evidence.
4. **Single source of truth.** Every fact (a type, a route path, a config value,
   a design token, an enum, a label) lives in exactly one place and is imported
   from there. Duplicating a value is a bug.
5. **No hardcoding.** No magic strings/numbers/URLs/colors in feature code.
   Everything comes from a token, a config, an env var, or the shared contract.
6. **Every data field is database-backed.** No application data may live in
   `localStorage`, in-memory stores, or hardcoded fixtures as its source of
   truth. When you add a field or entity, you add the Prisma column/model +
   migration, expose it through the backend module + shared contract, and the
   frontend reads/writes it via the API. **Never add a field without a database
   column for it.** (Auth tokens and the chosen-avatar preference are the only
   sanctioned client-side values; do not add more.)

---

## 1. Repository shape

npm workspaces monorepo. Three packages — keep the boundaries clean:

- `@cnsofts/shared` — the cross-cutting **contract**: domain types, Zod schemas,
  API route constants. Depends on nothing but `zod`. **Source of truth for both
  sides.** Rebuild (`npm run build:shared`) after editing before typechecking
  consumers.
- `@cnsofts/backend` — Node + Express + TypeScript + Prisma (Postgres).
- `@cnsofts/frontend` — Next.js (App Router) + TypeScript.

Run everything from the root: `npm run dev`, `npm run build`, `npm run typecheck`.
Postgres runs in Docker (`docker compose up -d`) on host port **5434**.

---

## 2. The contract (`@cnsofts/shared`) — single source of truth

- Define every domain model **once** as a Zod schema; derive the TS type with
  `z.infer`. Never hand-write a type that a schema already describes.
- API paths live only in `API_ROUTES` / `apiPaths`. The backend mounts routers
  at those paths; the frontend builds request URLs from them. **No endpoint
  string is written anywhere else.**
- Enum values and their human labels (e.g. `userRoleSchema`, `USER_ROLE_LABELS`)
  live here and are consumed by both sides. Never re-list options in a component.

---

## 3. Backend rules

**Layering — strict, feature-based. No "random" files.**

```
src/
  server.ts                 # bootstrap only (create app, listen)
  app.ts                    # middleware + mount registry + error handling
  router.ts                 # SINGLE SOURCE: registers every module's router
  infra/                    # env.ts (validated config), prisma.ts (singleton)
  shared/http/              # http-error, async-handler, validate, error-middleware
  modules/<feature>/        # <feature>.controller.ts | .service.ts | .routes.ts
```

- **Controllers are thin**: validate input with `validate(schema, req.body)`,
  delegate to the service, shape the response. No business logic, no direct DB.
- **Services own business logic and persistence** (Prisma). They throw
  `HttpError` for domain failures. They are the only place DB access happens.
- **Routes** wire controller handlers to paths. Register the module in
  `router.ts` using the `API_ROUTES` constant — one line per feature.
- **All input is validated at the boundary** with the shared Zod schema before
  it reaches a service. Treat `req.body`, params, and query as untrusted.
- **Errors**: throw `HttpError` (`.badRequest/.unauthorized/.notFound/.conflict`)
  or map known Prisma errors (`P2002` → 409, `P2025` → 404). The central
  middleware renders the `ApiError` envelope. Never `res.status(500)` by hand in
  a handler.
- **Config only via `infra/env.ts`** (Zod-validated). Never read `process.env`
  anywhere else. Missing/invalid env must fail fast at startup.
- **One Prisma client** (the `infra/prisma.ts` singleton). Never `new
  PrismaClient()` elsewhere.
- Async handlers are wrapped with `asyncHandler` so rejections reach the error
  middleware. No unguarded async route callbacks.

---

## 4. Frontend rules

**Feature-based. Presentational vs. data concerns stay separated.**

```
src/
  app/                      # routes only (thin; delegate to features/components)
  components/ui/            # design system (generic, reusable, no feature logic)
  components/brand|layout/  # brand + app-shell pieces
  features/<feature>/       # <feature>.api.ts, use-<feature>.ts, components/
  lib/                      # config.ts, api-client.ts, auth-storage.ts, cx.ts
  styles/tokens.css         # design tokens
```

- **No hardcoded URLs or config.** The API base is `lib/config.ts`
  (`NEXT_PUBLIC_API_URL`); requests go through `lib/api-client.ts`; paths come
  from `apiPaths`. Feature APIs (`features/<f>/<f>.api.ts`) build on the client —
  never call `fetch` directly in a component.
- **Design tokens only.** Colors, spacing, radii, typography, shadows come from
  the CSS variables in `styles/tokens.css`. **Never write a raw hex, px font
  size, or ad-hoc color** in a component style. Extend the tokens if something is
  missing.
- **Use the design system.** Compose `components/ui` primitives; do not build a
  one-off button/input/modal. If a primitive is missing, add it to `ui` properly
  (component + co-located `.module.css`), then use it.
- **Icons only via the `Icon` registry** (`components/ui/icon.tsx`), referenced
  by semantic name. Verify a name exists in the registry before using it; add new
  icons to the registry (with verified Hugeicons export names) — never import
  Hugeicons directly in a feature.
- **Styling = CSS Modules per component**, using tokens. No global class soup, no
  inline style objects for anything a token/class can express.
- Server vs. client components: keep components server-safe unless they need
  state/effects/browser APIs; mark `'use client'` only when required.

---

## 5. Type safety

- `strict` TypeScript is on and stays on. **No `any`.** No `@ts-ignore` /
  `@ts-expect-error` without a comment justifying it. Prefer `unknown` + narrowing
  over casts; a double-cast (`as unknown as T`) requires a one-line reason.
- Type external/boundary data through Zod, then trust the inferred type inward.
- Do not weaken a type to make an error disappear — fix the cause.

---

## 6. Security

- **No secrets in code or in the client.** Secrets live in backend env only.
  `.env` is gitignored; keep `.env.example` in sync (with placeholder values).
- Validate and normalize all untrusted input. Use constant-time comparison for
  credentials/tokens.
- Never log secrets, tokens, or full credentials.
- The app is **invite-only** — do not add self-service signup UI or endpoints.

---

## 7. Definition of Done (run before claiming completion)

1. `npm run build:shared` if the contract changed.
2. `npm run typecheck` (or per-package `tsc --noEmit`) — **zero errors**.
3. Build the affected package(s) (`next build` / backend `tsc`) — **succeeds**.
4. **Exercise the change**: hit the endpoint (curl) and/or load the page; confirm
   the actual behavior, including the failure paths you claim to handle.
5. Report honestly: what you verified, what you did not, and any follow-ups.

Never mark work complete on the strength of "it should work."

---

## 8. Conventions

- **Files**: `kebab-case` (`user-role-badge.tsx`, `users.service.ts`).
- **Components**: `PascalCase`. **Functions/vars**: `camelCase`. **Constants**:
  `UPPER_SNAKE_CASE`. **Types/interfaces**: `PascalCase`.
- Match the style of the surrounding code (imports, comments, naming). Comments
  explain **why**, not what.
- Keep diffs minimal and focused; do not reformat or refactor unrelated code in
  the same change.
- Do not delete or overwrite something you did not create or cannot explain —
  inspect it first and flag surprises.

---

## 9. When adding a new feature (checklist)

1. Add/extend schemas + types + paths in `@cnsofts/shared`; rebuild it.
2. Backend: `modules/<feature>/` with service → controller → routes; register in
   `router.ts`. Validate all input; throw `HttpError`.
3. Frontend: `features/<feature>/` with `<feature>.api.ts` (via `apiClient` +
   `apiPaths`), hook, and components built from `components/ui`.
4. Typecheck, build, smoke-test both sides. Update `.env.example` if config
   changed.
