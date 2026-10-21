# OneBase

OneBase is a personal anime tracker with account sync, instant persistence, automatic completion handling, and server-side episode-update notifications.

## Episode updates

- Wikipedia is used as the external episode-count signal through the MediaWiki API.
- Supabase Cron runs the worker every 6 hours, so update detection does not depend on OneBase being open.
- The worker reads each subscribed user's `anime-libraries/<uid>/library.txt`, detects increases such as `12 → 13`, and records notification delivery state in Supabase.
- Web Push subscriptions are stored per authenticated user with Row Level Security.
- VAPID keys are generated once and persisted in Supabase Vault; the private key never ships to the browser.
- Clicking an episode notification opens OneBase and attempts searches for the detected episode on Nyaa, SubPlease and EXT.to.
- When OneBase is open, the client-side checker also refreshes the library total so the UI reflects the new episode count immediately.

OneBase only opens external search pages; it does not download or distribute files.

<!-- Vercel redeploy marker: 2026-09-21 -->


## Movies and TV shows

- The audiovisual library is separate from anime episode tracking and is saved under `onebase_screen_library_v1` in the browser.
- Signed-in accounts sync it to a separate `screen-library.txt` object in the existing `anime-libraries` Supabase bucket; anime records and episode automations remain unchanged.
- Search and detail routes use TMDB's Movie and TV API. Set `TMDB_API_KEY` as a server-side Vercel environment variable (Development, Preview and Production as needed). Never add the key to browser code.
- TMDB requires API credentials and agreement to its terms. Non-commercial use requires TMDB attribution and its approved logo; commercial projects need a commercial license. The audiovisual library modal displays the required notice and logo. TMDB asks clients to respect `429` responses; its published guidance says practical upper limits are around 40 requests per second and may change. Review TMDB's current [API FAQ](https://developer.themoviedb.org/docs/faq), [authentication docs](https://developer.themoviedb.org/docs/authentication-application), and [rate-limit guidance](https://developer.themoviedb.org/docs/rate-limiting) before launch.
