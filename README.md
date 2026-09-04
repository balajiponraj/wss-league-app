# WSS League Desk

A Vercel-friendly league dashboard for the WHITBY SMASH SQUAD (WSS) team. This app is built with Next.js, TypeScript, and Tailwind CSS and is designed to be a polished internal scoreboard and management dashboard similar in style to a sports league admin tool.

## Features

- Team dashboard with quick stats
- League standings and player rankings
- Match tracking and fixture preview
- Cost ledger and budget awareness
- WSS-branded dark theme tuned for local league management
- Ready for deployment on Vercel Hobby for free or low-cost hosting

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Production build

```bash
npm run build
npm run start
```

## Supabase database setup

The app works in local browser-storage mode until Supabase is configured. To enable shared team data:

1. Open [supabase.com](https://supabase.com), create an account, and create a new project.
2. In the Supabase dashboard, open **SQL Editor** and choose **New query**.
3. Copy the complete contents of `supabase-schema.sql` into the query, then click **Run**. If you already ran an older version, run this updated file again; it adds doubles teams, tournament formats, and live fixture support without deleting existing results.
4. Open **Project Settings -> API**. Copy the **Project URL** and the publishable/anon key.
5. Create a local `.env.local` file by copying `.env.example`, then replace both placeholder values.
6. Restart the development server with `npm run dev`.

Never commit `.env.local` or share its values. The `.gitignore` file already excludes environment files.

## Vercel deployment

1. Push this project to GitHub.
2. Import the repo in Vercel.
3. Use the default Next.js settings.
4. Before deploying, open the Vercel project **Settings -> Environment Variables** and add:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Redeploy the project.

For a personal or team project, the default Vercel Hobby plan is typically sufficient for initial hosting without paying for a plan.

The initial policies allow anyone with the public app to read and add WSS players and match results. Add Supabase Authentication before using the app outside the team.

## Clear existing competition data

To start fresh, open Supabase **SQL Editor**, paste the contents of `clear-wss-data.sql`, and click **Run**. This permanently deletes all players, teams, tournaments, and match results while keeping the tables and policies. Only run it when you are ready to erase the current data.

If tournament creation says `event_date` is missing, run `supabase-migration-schedule.sql` in the Supabase SQL Editor. This adds the schedule columns without deleting any existing data.

For tournament-specific pairs and score updates, run `supabase-migration-tournament-pairs.sql` in the Supabase SQL Editor. It adds the tournament group/count fields, links pairs to tournaments, and permits updating a saved fixture.

## Admin access

Public visitors can view standings, the dashboard, and playoff results and can update match results. Players and Leagues are admin-only. To create the admin login, open Supabase **Authentication -> Users -> Add user**, enter the administrator email and a password, and create the user. There is intentionally no public signup screen.

Run the latest `supabase-migration-tournament-pairs.sql` after enabling this access model. It keeps player, team, and league mutations restricted to authenticated users while leaving match result updates available publicly.
