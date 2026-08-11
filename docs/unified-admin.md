# Unified admin architecture

## Content pipeline

`Drama metadata + local preview files` → `signed browser upload` → `R2 public episode URLs` → `encrypted draft` → `publish` → `public watch page`

The add-drama flow owns ingestion. It accepts up to 10 preview files, sorts them naturally by filename, uploads sequentially with progress, and stores only the resulting public URLs.

## Social production pipeline

`published drama` → `select R2 episodes` → `Vizard settings` → `one API submission per episode` → `30-second client-side interval`

Vizard is downstream and optional. A Vizard outage never blocks publishing or playback, and an episode is not uploaded twice.

## Operational requirements

- R2 bucket CORS must allow `PUT` from `http://localhost:3000` and `https://dramaclips.vercel.app`.
- R2 public media should use a stable public/custom domain.
- `R2_*`, `VIZARD_API_KEY`, Supabase service role, encryption, admin session, and CPS values must remain server-side secrets.
- The current admin password is suitable for a private single-operator workspace. Replace it with Supabase Auth before adding staff accounts or role-based access.
