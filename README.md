# Bbodong

Bbodong is a shared weekly buffer prototype for newly married dual-income couples.

## Current Product Surface

- `Home`: weekly buffer summary and the one thing to discuss
- `Timeline`: filterable shared events
- `Check-in`: a three-step weekly ritual
- `Rules`: lightweight guardrails that can be toggled on and off

## Stack

- `next@16.2.1`
- `react@19`
- `tailwindcss@4`
- `@supabase/supabase-js`
- `vitest` + React Testing Library

## Project Structure

- `src/app/page.tsx`: server route entry
- `src/components/home-client.tsx`: interactive UI state and rendering
- `src/lib/env.ts`: public env checks for the UI
- `src/lib/supabase/client.ts`: optional Supabase client bootstrap
- `supabase/schema.sql`: starter schema for moving state from local storage into Supabase

## Environment

If Supabase env vars are missing, the UI still renders and shows a disconnected badge instead of crashing.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Commands

```bash
npm run dev
npm run lint
npm run test
```

Open `http://localhost:3000` after starting the dev server.

## Testing

The current component tests cover:

- timeline category filtering
- full check-in completion and reset
- rules toggle count updates
- locale switching and document language updates
- local state restore and reset behavior
- Supabase missing-table fallback state
- public env fallback and Supabase client bootstrap

Test files:

- `src/components/home-client.test.tsx`
- `src/lib/env.test.ts`
- `src/lib/supabase/client.test.ts`

## Supabase Next Step

The current app persists live UI state in browser storage so the prototype already keeps user changes between reloads.

To move that state into Supabase, apply `supabase/schema.sql` in the Supabase SQL editor first. The current project does not yet have a public table available, which is why the app is not writing remote state today.
