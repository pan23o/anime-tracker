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
