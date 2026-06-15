# Insurance Policy Simplifier

An AI-powered web app that reads insurance policy PDFs and delivers a plain-English breakdown — what's covered, what isn't, how to claim, and what to watch out for. Includes a multilingual voice explanation feature (English, Hindi, Marathi).

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Folder Structure](#folder-structure)
4. [API Reference](#api-reference)
5. [Database Schema](#database-schema)
6. [Environment Variables](#environment-variables)
7. [Local Development](#local-development)
8. [Deployment](#deployment)
9. [Gotchas & Known Constraints](#gotchas--known-constraints)

---

## Features

- **PDF Upload** — drag-and-drop or click-to-browse, max 10 MB, text-based PDFs only
- **AI Analysis** — Gemini 2.5 Flash extracts and simplifies: coverage, exclusions, claim steps, warnings, waiting periods, and a plain-English summary
- **Claim Difficulty Score** — `X/10 — Label` rating with a short reason
- **Policy History** — all previously analyzed policies with aggregate stats
- **Voice Explanation** — on-demand spoken summary in English, Hindi, or Marathi using the browser Web Speech API
- **Retry Logic** — automatic exponential-backoff retry (up to 4 attempts) for transient Gemini 503/429 errors

---

## Architecture

```
Browser (React + Vite)
        │  HTTP / multipart form
        ▼
Shared Reverse Proxy  (path-based routing, port 80)
        │
        ├── /                  → Frontend  (Vite dev server)
        └── /api               → API Server (Express 5, port 8080)
                    │
                    ├── multer  ──►  disk (uploads/ — temp, deleted after parse)
                    ├── pdf-parse ──►  extracted text
                    ├── Gemini 2.5 Flash ──►  structured JSON analysis
                    └── Drizzle ORM ──►  PostgreSQL
```

### Request lifecycle — PDF upload

1. Browser POSTs `multipart/form-data` to `/api/policies/upload`.
2. Multer writes the file to `artifacts/api-server/uploads/` (temp).
3. `pdf-parse` (loaded via `createRequire` for CJS compat) extracts plain text.
4. Text is sent to Gemini 2.5 Flash with a structured prompt; response JSON is parsed and validated.
5. The analysis row is inserted into PostgreSQL via Drizzle ORM.
6. The temp file is deleted from disk.
7. The new policy object is returned to the browser (HTTP 201).
8. The browser navigates to `/policies/:id`.

### Request lifecycle — voice explanation

1. Browser POSTs `{ language: "en" | "hi" | "mr" }` to `/api/policies/:id/explain`.
2. Server fetches the policy from the DB.
3. A conversational prompt is constructed and sent to Gemini 2.5 Flash.
4. The spoken-paragraph text is returned.
5. Browser plays it with `window.speechSynthesis`, selecting the best matching voice for the language.

### Retry strategy

All Gemini calls go through `withRetry` (max 4 attempts, backoff: 1 s → 2 s → 4 s → 8 s). Retried on HTTP status codes 429, 500, 502, 503, 504 and on messages containing `UNAVAILABLE`, `overloaded`, or `high demand`.

---

## Folder Structure

```
.
├── artifacts/
│   ├── api-server/                  # Express API server
│   │   ├── src/
│   │   │   ├── index.ts             # Entry point — starts server
│   │   │   ├── app.ts               # Express app, middleware (CORS, pino, JSON)
│   │   │   ├── routes/
│   │   │   │   └── policies/
│   │   │   │       └── index.ts     # All /policies routes
│   │   │   └── lib/
│   │   │       ├── gemini.ts        # Gemini integration + withRetry
│   │   │       └── logger.ts        # Pino logger singleton
│   │   ├── uploads/                 # Temp PDF storage (files deleted after use)
│   │   ├── build.mjs                # esbuild bundle script
│   │   └── package.json
│   │
│   └── insurance-simplifier/        # React + Vite frontend
│       ├── src/
│       │   ├── App.tsx              # Router (wouter) + TanStack Query provider
│       │   ├── pages/
│       │   │   ├── upload.tsx       # Home — drag-and-drop PDF upload
│       │   │   └── policies/
│       │   │       ├── index.tsx    # Policy history + stats dashboard
│       │   │       └── [id].tsx     # Policy detail + VoiceExplainer component
│       │   ├── components/
│       │   │   ├── layout.tsx       # Shared page shell (nav, container)
│       │   │   └── ui/              # shadcn/ui components
│       │   └── index.css            # Tailwind CSS entry
│       └── package.json
│
├── lib/
│   ├── api-spec/
│   │   ├── openapi.yaml             # OpenAPI 3.1 contract (source of truth)
│   │   └── orval.config.ts          # Code generation config
│   ├── api-zod/
│   │   └── src/generated/           # Zod schemas generated from openapi.yaml
│   ├── api-client-react/
│   │   └── src/generated/           # TanStack Query hooks generated from openapi.yaml
│   └── db/
│       ├── src/
│       │   ├── index.ts             # Drizzle client export
│       │   └── schema/
│       │       └── policies.ts      # PostgreSQL table definition
│       └── drizzle.config.ts        # Drizzle Kit config
│
├── scripts/                         # Shared utility scripts
├── pnpm-workspace.yaml              # Workspace package discovery + catalog pins
├── tsconfig.base.json               # Shared TypeScript strict defaults
├── tsconfig.json                    # Root solution file (composite libs only)
└── package.json                     # Root dev tooling + workspace scripts
```

---

## API Reference

Base URL: `/api`

All responses are JSON. Error bodies follow `{ "error": "string" }`.

---

### Health

#### `GET /api/healthz`

Returns server health status.

**Response 200**
```json
{ "status": "ok" }
```

---

### Policies

#### `POST /api/policies/upload`

Upload a PDF and receive an AI-generated analysis.

**Request** — `multipart/form-data`

| Field | Type | Notes |
|-------|------|-------|
| `pdf` | file | PDF only, max 10 MB |

**Response 201** — `Policy` object (see [Schemas](#schemas))

**Error responses**

| Status | Meaning |
|--------|---------|
| 400 | No file provided, or non-PDF file |
| 422 | PDF contains no extractable text (scanned image) |
| 429 | Gemini API quota exceeded |
| 500 | Analysis failed |
| 502 | AI returned unexpected response |

---

#### `GET /api/policies`

List all analyzed policies, newest first.

**Response 200** — `Policy[]`

---

#### `GET /api/policies/stats`

Aggregate stats across all analyzed policies.

**Response 200** — `PolicyStats`
```json
{
  "total_policies": 12,
  "policy_types": [
    { "type": "Health", "count": 7 },
    { "type": "Life", "count": 5 }
  ],
  "avg_difficulty_score": "Varies by policy",
  "recent_policies": [ /* last 5 Policy objects */ ]
}
```

> **Note:** This route is registered before `GET /policies/:id` in Express so the literal path `"stats"` is never matched as an ID parameter.

---

#### `GET /api/policies/:id`

Fetch a single policy by its integer ID.

**Response 200** — `Policy`
**Response 404** — not found

---

#### `POST /api/policies/:id/explain`

Generate a conversational spoken explanation of the policy in a chosen language.

**Request body**
```json
{ "language": "en" }
```

| `language` | Language |
|-----------|----------|
| `en` | English |
| `hi` | Hindi |
| `mr` | Marathi |

**Response 200**
```json
{
  "text": "This policy, the HDFC Sanchay Plan...",
  "language": "en"
}
```

**Response 404** — policy not found

---

### Schemas

#### `Policy`

```typescript
{
  id: number
  filename: string
  policy_name: string
  policy_type: string           // e.g. "Health", "Life", "Auto"
  simple_explanation: string    // 2-3 sentence plain-English summary
  claim_difficulty_score: string // e.g. "3/10 — Easy"
  coverage: string[]
  exclusions: string[]
  claim_process: string[]       // ordered steps
  important_warnings: string[]
  waiting_periods: string[]
  created_at: string            // ISO 8601
}
```

---

## Database Schema

Single table: **`policies`** (PostgreSQL)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `serial` | Primary key, auto-increment |
| `filename` | `text` | Original uploaded filename |
| `policy_name` | `text` | AI-extracted policy name |
| `policy_type` | `text` | e.g. Health, Life, Auto, Home |
| `simple_explanation` | `text` | Plain-English 2-3 sentence summary |
| `claim_difficulty_score` | `text` | e.g. `"3/10 — Easy"` |
| `coverage` | `text[]` | Array of covered items |
| `exclusions` | `text[]` | Array of exclusions |
| `claim_process` | `text[]` | Ordered claim steps |
| `important_warnings` | `text[]` | Critical warnings |
| `waiting_periods` | `text[]` | Waiting period descriptions |
| `created_at` | `timestamp` | Defaults to `now()` |

Schema is defined in `lib/db/src/schema/policies.ts` using Drizzle ORM.

**Push schema changes (dev only):**
```bash
pnpm --filter @workspace/db run push
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Provided automatically by Replit's built-in database. |
| `GEMINI_API_KEY` | Yes | Google Gemini API key. Set in Replit Secrets. Get one free at [ai.google.dev](https://ai.google.dev). |
| `SESSION_SECRET` | Yes | Secret for signing sessions (used by middleware). Set in Replit Secrets. |
| `PORT` | Auto | Injected by Replit's workflow runner. Do not hard-code. |
| `NODE_ENV` | Auto | Set to `development` by the dev script; `production` in deployed environments. |

> **Never** commit `.env` files or paste secrets in source code. Use Replit Secrets (the lock icon in the sidebar).

---

## Local Development

### Prerequisites

- Node.js 24+
- pnpm 9+
- A PostgreSQL database (Replit provides one automatically)
- A Gemini API key

### First-time setup

```bash
# Install all workspace dependencies
pnpm install

# Push the database schema
pnpm --filter @workspace/db run push
```

### Running the app

Start both services (each in its own terminal or Replit workflow):

```bash
# API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Frontend (port from $PORT env var, typically 22063 in dev)
pnpm --filter @workspace/insurance-simplifier run dev
```

The Replit proxy routes `/api/*` to the API server and everything else to the frontend automatically.

### Type-checking

```bash
# Full check across all packages
pnpm run typecheck

# Single package
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/insurance-simplifier run typecheck
```

### Regenerating API code

After any change to `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates:
- `lib/api-zod/src/generated/` — Zod request/response schemas
- `lib/api-client-react/src/generated/` — TanStack Query hooks

---

## Deployment

The app is deployed via Replit's built-in publish flow.

### Steps

1. Ensure both `DATABASE_URL` and `GEMINI_API_KEY` are set in **Replit Secrets**.
2. Click **Publish** in the Replit interface (or use the Deploy button in the agent toolbar).
3. Replit builds and hosts the app at a `.replit.app` domain over HTTPS.
4. The reverse proxy configuration in each artifact's `artifact.toml` routes traffic correctly — no extra configuration needed.

### Production vs. development

| | Development | Production |
|-|-------------|------------|
| Database | Replit-managed PostgreSQL (same instance) | Replit-managed PostgreSQL (same instance) |
| API base URL | `localhost:80/api` (via proxy) | `https://<your-app>.replit.app/api` |
| File uploads | `artifacts/api-server/uploads/` | Same path inside the container |
| Gemini retries | Enabled | Enabled (same code) |

> **Schema migrations in production:** If you change the DB schema after publishing, run `pnpm --filter @workspace/db run push` from the Replit shell — it applies the diff to the live database.

### Checking production logs

Use Replit's deployment log viewer, or fetch them programmatically. All server logs are structured JSON emitted by Pino.

---

## Gotchas & Known Constraints

| Constraint | Detail |
|-----------|--------|
| **pdf-parse must stay at v1** | v2 changed to a class-based `PDFParse` API that is not callable as a function. Pin to `^1.1.4`. |
| **pdf-parse loaded via `createRequire`** | It is a CJS module. ESM `import` will fail. Always use `createRequire(import.meta.url)`. |
| **`/policies/stats` before `/policies/:id`** | Express matches routes top-to-bottom. If `:id` is registered first, the string `"stats"` is treated as an ID and the stats route is never reached. |
| **`created_at` is a `Date` from Drizzle** | Call `.toISOString()` before passing to Zod schemas — Zod expects a `string`. |
| **Gemini model** | Use `gemini-2.5-flash` with the `@google/genai` SDK (v2+). The older `@google/generative-ai` SDK used the deprecated `v1beta` endpoint which returns 404s. |
| **PDF text limit** | Only the first 50,000 characters of extracted text are sent to Gemini to stay within token limits. |
| **Scanned PDFs not supported** | `pdf-parse` extracts digital text only. Image-only (scanned) PDFs return a 422 error. |
| **Web Speech API availability** | Voice playback uses the browser's built-in `window.speechSynthesis`. Quality and language support vary by OS and browser. Hindi and Marathi voices are available on most modern Android/Chrome and macOS/Safari installations. |
| **Free-tier Gemini quota** | The free tier has per-minute rate limits. The retry logic handles transient 503s, but sustained 429s mean the daily/minute quota is exhausted — the user must wait or enable billing. |
