# Insurance Policy Simplifier

An AI-powered web app that lets users upload insurance policy PDFs and receive a plain-English breakdown — coverage, exclusions, claims process, warnings, and more.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/insurance-simplifier run dev` — run the frontend (port 22063)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `GEMINI_API_KEY` — Google Gemini API key for AI analysis

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (wouter, TanStack Query, shadcn/ui, Tailwind)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: Google Gemini 1.5 Flash (via `@google/generative-ai`)
- PDF extraction: `pdf-parse` (CJS via `createRequire`)
- File uploads: `multer` (disk storage, max 10MB)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/policies.ts` — DB schema for analyzed policies
- `artifacts/api-server/src/routes/policies/index.ts` — PDF upload, AI analysis, CRUD routes
- `artifacts/api-server/src/lib/gemini.ts` — Gemini AI integration + prompt
- `artifacts/api-server/uploads/` — temp upload directory (files deleted after processing)
- `artifacts/insurance-simplifier/src/` — React frontend

## Architecture decisions

- PDF files are stored temporarily on disk (via multer), parsed with pdf-parse using `createRequire` (CJS compat), then deleted after Gemini analysis.
- Gemini prompt returns structured JSON; response is cleaned of markdown code fences before parsing.
- The `/api/policies/stats` endpoint is mounted before `/api/policies/:id` so the literal "stats" path doesn't get matched as an ID.
- pdf-parse is loaded via `createRequire` to avoid ESM/CJS module type conflicts.

## Product

- Upload page: drag-and-drop PDF upload with progress indicator
- Results dashboard: policy name, type, simple explanation, difficulty score, coverage, exclusions, claims process, waiting periods, warnings
- History page: all previously analyzed policies with aggregate stats

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `pdf-parse` must be loaded with `createRequire` (not ESM import) — it's a CJS module
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- The `/policies/stats` route must be defined before `/policies/:id` in Express

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
