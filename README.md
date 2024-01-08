# VaxInfo

AI-Powered Vaccine Intelligence Platform for smart disease search, structured vaccine metadata, and persistent AI chat.

## Live Demo

- App: https://vaxinfo.vercel.app
- Dashboard: https://vaxinfo.vercel.app/dashboard
- Search API: https://vaxinfo.vercel.app/api/search?disease=polio
- Vaccines API: https://vaxinfo.vercel.app/api/vaccines
- Health Check: https://vaxinfo.vercel.app/api/health

## Screenshots

Replace these placeholders with real captures from your deployment.

- Home Search Experience: docs/screenshots/home-search.png
- Search Results and Ranking: docs/screenshots/search-results.png
- AI Chatbot with Session Memory: docs/screenshots/chatbot-memory.png
- WHO Analytics Dashboard: docs/screenshots/dashboard.png

## Features

### Search System

- Fuzzy disease matching with Fuse.js
- Alias normalization and exact/alias/fuzzy match strategy
- Ranked response quality with score output
- Related disease discovery based on shared vaccine profiles

### AI Chatbot

- Natural-language disease and analytics questions
- Intent handling for greeting, disease, analytics, and fallback flows
- Session persistence using database-backed chat history
- Resume chat sessions through sessionId retrieval

### Dashboard

- WHO-style analytics summary cards
- Regional filtering across WHO regions
- Coverage segmentation and category distribution
- Vaccine introduction timeline and top coverage views

### Public APIs

- GET /api/search for direct disease lookup
- GET /api/vaccines for full enriched dataset
- GET and POST /api/chat for conversational intelligence and history
- GET /api/health for uptime monitoring

## Tech Stack

### Frontend

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React

### Backend

- Next.js Route Handlers
- Prisma ORM
- Fuse.js search engine

### Database

- PostgreSQL (Supabase)

### Deployment

- Vercel

## Architecture Overview

### Search Pipeline

1. User query arrives at /api/search.
2. System attempts exact disease name match.
3. System attempts alias match (for example, common shorthand to canonical disease).
4. Fuse.js fuzzy search handles typos and non-exact phrasing.
5. API returns best match, vaccine list, match type, and score.

### Chatbot Pipeline

1. Frontend sends message plus optional sessionId to /api/chat (POST).
2. API classifies intent: greeting, disease query, analytics query, or fallback.
3. Disease resolution combines heuristic extraction and fuzzy matching.
4. Assistant response is generated from structured disease/vaccine records.
5. Both user and assistant messages are stored in ChatMessage, scoped by ChatSession.
6. Frontend can restore conversation history via /api/chat?sessionId=... (GET).

### Data Model Summary

- Disease: canonical disease record, aliases, category, related vaccines
- Vaccine: vaccine metadata including type, doses, region, and coverage
- ChatSession: conversation container for message history
- ChatMessage: persistent message log with role, content, metadata, and timestamp

## API Documentation

### GET /api/search?disease=polio

Returns the best matching disease and vaccine names.

Example response:

```json
{
   "disease": "Poliomyelitis",
   "vaccines": ["OPV", "IPV"],
   "matchType": "alias",
   "score": 0
}
```

### GET /api/vaccines

Returns the full disease dataset with enriched vaccine metadata.

Example response:

```json
{
   "diseases": [
      {
         "id": 13,
         "name": "Poliomyelitis",
         "aliases": ["polio"],
         "category": "viral",
         "hasVaccine": true,
         "vaccines": [
            {
               "name": "OPV",
               "type": "Live attenuated",
               "doses": "Multiple",
               "coveragePercent": 82,
               "region": "South-East Asia"
            }
         ]
      }
   ]
}
```

### POST /api/chat

Processes conversational queries and persists session history.

Example request body:

```json
{
   "message": "Tell me about measles",
   "sessionId": "cmo3x7wvi0000giod5911ipb4"
}
```

Example response:

```json
{
   "answer": "For Measles, vaccine options include MMR...",
   "kind": "disease",
   "disease": "Measles",
   "score": 0,
   "sessionId": "cmo3x7wvi0000giod5911ipb4"
}
```

### GET /api/chat?sessionId=<id>

Loads persisted chat history for an existing session.

### GET /api/health

Simple uptime endpoint.

Example response:

```json
{
   "status": "ok"
}
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL database (local or Supabase)

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

### Quality Checks

```bash
npm run lint
npm run build
```

## Environment Variables

Set the following values in .env:

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_APP_URL=
```

- DATABASE_URL: pooled/runtime connection string (recommended for app traffic)
- DIRECT_URL: direct database connection string (recommended for Prisma migrations)
- NEXT_PUBLIC_APP_URL: public base URL (local or deployed)

## Deployment

### Supabase

1. Create a Supabase project.
2. Collect pooled and direct Postgres URLs.
3. Apply Prisma migrations and seed data:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

### Vercel

1. Link the GitHub repository in Vercel.
2. Configure environment variables: DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_APP_URL.
3. Deploy via dashboard or CLI:

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
      page.tsx
   components/
      chat/
      dashboard/
      search/
      ui/
   lib/
      prisma.ts
   prisma/
      migrations/
      schema.prisma
      seed.ts
```

## Future Improvements

- Authentication and user-scoped chat sessions
- Exportable analytics reports (CSV/PDF)
- Cached query layer for high-traffic API usage
- Internationalization for multilingual disease names and aliases
- Improved charting with comparative historical trends

## License

MIT

## Disclaimer

VaxInfo is for informational and engineering demonstration purposes only and does not replace professional medical advice.
