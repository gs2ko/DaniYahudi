# Barterin — baterin aja

Barter marketplace web app built with React + TypeScript + Vite and Supabase.

## Run locally

1. Create/open your project at https://supabase.com.
2. In Supabase → SQL Editor, run `supabase/migrations/001_init.sql`. Optionally run `supabase/seed.sql` for sample listings.
3. Open `.env` in this folder (the same folder as `package.json`). The included `.env` has blank values on purpose. Copy the actual **Project URL** and **anon/public key** from Supabase → Project Settings → API into these two lines:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

   Replace the placeholders with your real values. Do not add quotes unless your value requires them, and never publish your key. `.env` must not be named `.env.txt`.
4. Open a terminal in this `barterin-web` folder and run `npm.cmd install`, then `npm.cmd run dev` on Windows PowerShell.
5. If Vite was already running when you edited `.env`, stop it with `Ctrl+C` and run `npm.cmd run dev` again. Vite only loads `.env` at startup.
6. If signup emails are inconvenient during testing, in Supabase → Authentication settings you can temporarily adjust email confirmation.

## Deploy

Push this folder to GitHub, import the repository in Vercel, and add the same two environment variables in Vercel Project Settings → Environment Variables. Set the Supabase Site URL and Redirect URLs to your deployed URL.

## Important

The project cannot connect to your Supabase database until you provide your own Project URL and anon/public key. These values are specific to your Supabase project, so they cannot be filled in automatically. Do not share your `service_role` key.
