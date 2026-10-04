# Barterin — baterin aja

Barter marketplace web app. React + TypeScript + Vite, with Supabase (auth, Postgres, storage, realtime) and Vercel hosting.

## Run locally
1. Create a free project at https://supabase.com.
2. In Supabase > SQL Editor, run `supabase/migrations/001_init.sql`, then (optional) `supabase/seed.sql` for clearly labelled sample listings.
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase > Project Settings > API).
4. `npm install` then `npm run dev`.
5. For quick testing, turn off "Confirm email" in Supabase > Authentication > Providers > Email.

## Deploy
1. Push this folder to a GitHub repository.
2. In Vercel, import the repo (Vite is auto-detected; `vercel.json` handles SPA routing).
3. Add the same two environment variables in Vercel > Settings > Environment Variables, then deploy.
4. In Supabase > Authentication > URL Configuration, set Site URL and Redirect URLs to your Vercel URL.
5. Check: `npm run build` passes locally; sign up on the live URL, publish an offer with photos, open it from a second account.

## Included
Browse and search, sign up and log in, create offers with up to 5 photos, multi-item trade proposals with optional cash, accept, decline, cancel and complete, per-trade realtime chat, sample-listing labels, SQL with row-level security and storage policies.

## Not yet built
Interest selection, public profile pages, counter-offers, reviews, saved listings, follows, notifications, account and privacy settings, and the full Material/Corporate Memphis polish from the missing `A.txt`.
