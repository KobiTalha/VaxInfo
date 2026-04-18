# VaxInfo

AI-powered vaccine intelligence platform with smart search, chatbot, analytics dashboard, and public API built using Next.js, Prisma, and PostgreSQL.

## Live Demo

- App: https://vaxinfo.vercel.app
- Dashboard: https://vaxinfo.vercel.app/dashboard
- Search API: https://vaxinfo.vercel.app/api/search?disease=polio
- Vaccines API: https://vaxinfo.vercel.app/api/vaccines
- Health API: https://vaxinfo.vercel.app/api/health

## Features

### Search Engine

- Multi-stage matching (exact -> alias -> fuzzy)
- Fuse.js typo tolerance and ranking
- Match metadata (`matchType`, `score`) in API responses
- Related disease discovery from shared vaccine associations

### AI Chatbot

- Natural language disease and analytics queries
- Intent routing (greeting, disease, analytics, fallback)
- Persistent session memory backed by PostgreSQL
- Session resume via `sessionId`

### Dashboard

- WHO-style analytics with region filters
- Coverage segmentation and category distribution
- Vaccine introduction timeline
- Top coverage vaccine leaderboard

### API

- Public search endpoint for disease lookup
- Public vaccine dataset endpoint
- Chat API with session persistence
- Health check endpoint for uptime monitoring

## Tech Stack

### Frontend

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion

### Backend

- Next.js Route Handlers
- Prisma ORM
- Fuse.js

### Database

- PostgreSQL (Supabase)

### Deployment

- Vercel

## Architecture Overview

### Search Pipeline

1. Normalize incoming query.
2. Attempt exact disease match.
3. Attempt alias match.
4. Run Fuse.js fuzzy search when needed.
5. Rank and return the best candidate with metadata.

### Chatbot Pipeline

1. Client sends `message` and optional `sessionId` to `POST /api/chat`.
2. API classifies intent and extracts disease/analytics context.
3. Response is built from structured disease-vaccine data.
4. User and assistant messages are persisted in chat tables.
5. Session history is restored with `GET /api/chat?sessionId=...`.

### Data Model Summary

- `Disease`: canonical disease metadata + aliases
- `Vaccine`: structured vaccine data linked to disease
- `ChatSession`: conversation container
- `ChatMessage`: timestamped role-based messages

## System Design Highlights

- Designed a multi-stage search pipeline (alias -> fuzzy -> ranking)
- Implemented persistent chat sessions using relational database modeling
- Built scalable API endpoints for public data access
- Structured WHO-style dataset with normalized relationships

## Performance Considerations

- Indexed database queries for fast lookup
- Limited chat history retrieval for efficiency
- Used connection pooling via Supabase
- Optimized API responses for minimal payload

## API Documentation

### Example Request

`GET /api/search?disease=measles`

### Example Response

```json
{
  "disease": "Measles",
  "vaccines": ["MMR"],
  "matchType": "fuzzy",
  "score": 0.02
}
```

### Additional Endpoint Notes

- `GET /api/vaccines`: returns full enriched disease-vaccine dataset.
- `POST /api/chat`: processes conversational query and returns structured answer + `sessionId`.
- `GET /api/chat?sessionId=<id>`: returns persisted chat history.
- `GET /api/health`: returns `{ "status": "ok" }`.

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL (local or Supabase)

### Local Setup

```bash
git clone https://github.com/KobiTalha/VaxInfo
cd VaxInfo
npm install
copy .env.example .env
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

### Validation

```bash
npm run lint
npm run build
```

## Environment Variables

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_APP_URL=
```

- `DATABASE_URL`: pooled runtime DB connection string
- `DIRECT_URL`: direct migration DB connection string
- `NEXT_PUBLIC_APP_URL`: public app base URL

## Deployment

### Supabase

1. Create a Supabase project.
2. Copy pooled and direct PostgreSQL URLs.
3. Apply migrations and seed:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

### Vercel

1. Import repository in Vercel.
2. Set `DATABASE_URL`, `DIRECT_URL`, and `NEXT_PUBLIC_APP_URL`.
3. Deploy:

```bash
npx vercel --prod
```

## Folder Structure

```text
VaxInfo/
  app/
    api/
      chat/
      health/
      search/
      vaccines/
    dashboard/
  components/
    chat/
    dashboard/
    search/
    ui/
  lib/
    prisma.ts
    utils.ts
  prisma/
    migrations/
    schema.prisma
    seed.ts
```

## Status

- [x] Fully deployed
- [x] Production-ready
- [x] Public API available
- [x] Persistent chatbot system implemented

## Future Improvements

- User-authenticated chat ownership
- API rate limiting and API key support
- Dashboard exports (CSV/PDF)
- Multilingual alias support

## License

MIT

## Disclaimer

VaxInfo is for informational and engineering demonstration purposes only and is not a substitute for professional medical advice.
