# VaxInfo

Production-grade vaccine intelligence platform built with Next.js (App Router), TypeScript, Prisma, and PostgreSQL.

VaxInfo now includes intelligent multi-disease search, context-aware chatbot flows, advanced analytics, authentication, API key platform controls, exports, testing, and CI/CD.

## Release Snapshot (2026-04-19)

- Production deployment defaults updated for Vercel + Supabase.
- API key lifecycle now supports create, rotate, revoke, activate, and delete.
- Added DB-backed transactional route tests for developer key flows.

## Core Capabilities

- Intelligent Search
- Multi-disease query support (`measles and polio vaccines`)
- Intent detection (`search`, `explanation`, `recommendation`, `analytics`)
- Recommendation generation (child schedule, travel)
- Severity and mandatory tagging
- Search log persistence and trend analytics

- AI Chatbot
- Context-aware responses using recent chat history
- Multi-question handling
- Explanation mode (`Why is MMR important?`)
- Optional LLM enhancement via environment flags
- Bounded history retrieval and user-linked sessions

- Analytics + Dashboard
- Most searched diseases and query trends over time
- Region demand analytics
- Export dashboard data as CSV/PDF
- Shareable dashboard state by URL
- Personalized dashboard preference and saved diseases

- API Platform
- API key creation/listing for signed-in users
- Rate limiting for anonymous and key-based traffic
- API usage tracking per endpoint
- Developer documentation page (`/developers`)
- Embeddable widget page (`/embed`)

- Auth + User Features
- NextAuth credentials login
- Registration endpoint
- User-specific saved diseases
- User-specific chat session ownership
- User dashboard preference persistence

- DevOps + Reliability
- Health endpoint with DB connectivity checks
- Structured server error logging to DB
- Vitest test setup (`npm test`)
- GitHub Actions CI + optional Vercel deploy pipeline

## Updated Data Model

Key model upgrades include:

- `Disease`: `severity`, `mandatory`
- `Vaccine`: `sideEffects`, `dosageSchedule`, `ageGroup`, `vaccineType`
- `SearchLog`: query/event analytics persistence
- Auth models: `User`, `Account`, `Session`, `VerificationToken`
- User features: `SavedDisease`, `UserDashboardPreference`
- API platform: `ApiKey`, `ApiUsage`
- Reliability: `ErrorLog`

See [prisma/schema.prisma](prisma/schema.prisma) and migration [prisma/migrations/20260419090000_production_upgrade_core/migration.sql](prisma/migrations/20260419090000_production_upgrade_core/migration.sql).

## API Endpoints

- Public/Platform
- `GET /api/search?disease=<query>&page=1&pageSize=10`
- `GET /api/vaccines?page=1&pageSize=50&region=<region>&category=<category>`
- `GET /api/analytics?days=30`
- `GET /api/dashboard/export?format=csv|pdf&region=<region>`
- `GET /api/health`

- Chat
- `POST /api/chat`
- `GET /api/chat?sessionId=<id>&limit=60`

- Auth
- `POST /api/auth/register`
- `GET/POST /api/auth/[...nextauth]`

- User
- `GET/POST/DELETE /api/user/saved-diseases`
- `GET/PUT /api/user/dashboard-preference`
- `GET /api/user/chats`

- Developer
- `GET/POST/PATCH/DELETE /api/developer/keys`
- `GET /api/developer/usage`

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
copy .env.example .env
```

3. Run migrations and seed:

```bash
npx prisma migrate dev
npm run prisma:seed
```

4. Start dev server:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run test:db
npm run build
npm run vercel:build
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:seed
```

## Vercel + Supabase Deployment

1. Create a Supabase project and collect:
- Project ref
- Database password
- Pooler host (port `6543`)
- Direct host (`db.<project-ref>.supabase.co`, port `5432`)

2. Use the production env template:

```bash
copy .env.supabase.example .env
```

3. In Vercel Project Settings -> Environment Variables, set:
- `DATABASE_URL` (Supabase pooler URL)
- `DIRECT_URL` (Supabase direct URL)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`

4. Run migrations against Supabase before or during deployment:

```bash
npm run prisma:migrate:deploy
```

5. Deploy:

```bash
npm run deploy:vercel
```

## Testing

Vitest configuration is in [vitest.config.ts](vitest.config.ts).

- Unit tests: [tests/unit/search-intelligence.test.ts](tests/unit/search-intelligence.test.ts), [tests/unit/password.test.ts](tests/unit/password.test.ts)
- Integration-style tests: [tests/integration/search-flow.integration.test.ts](tests/integration/search-flow.integration.test.ts)
- DB-backed transactional route tests: [tests/integration/db/developer-keys-lifecycle.db.test.ts](tests/integration/db/developer-keys-lifecycle.db.test.ts)

Run all tests with:

```bash
npm test
```

Run DB-backed route integration tests (requires `TEST_DATABASE_URL`):

```bash
npm run test:db
```

## CI/CD

GitHub Actions workflow:

- [ .github/workflows/ci.yml ](.github/workflows/ci.yml)

Pipeline stages:

- Install dependencies
- Lint
- Test
- DB-backed integration tests (Postgres service)
- Build
- Optional Prisma production migration during deploy job when `DIRECT_URL` secret is set
- Optional Vercel deploy on `main` if secrets are configured

## Developer UX

- API docs UI: `/developers`
- Embeddable vaccine search widget: `/embed`
- Sign-in/register UI: `/auth/signin`

## Notes

- Redis caching is optional. If Redis env vars are absent, the platform uses in-memory cache fallback.
- LLM integration is optional and controlled by `VAXINFO_ENABLE_LLM=true` plus OpenAI-compatible env vars.
- The seed script prints demo credentials and demo API key for local development.
- Use `.env.supabase.example` for production Vercel + Supabase environment setup.

## License

MIT
