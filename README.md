# OneBase

OneBase is a personal anime tracker with account sync, instant persistence, automatic completion handling, and episode-update notifications.

## Episode updates

- Wikipedia is used as the external episode-count signal.
- The app checks tracked anime periodically and detects increases such as `12 → 13`.
- When a new episode is detected, the library total is updated without changing the watched count.
- Browser notifications are supported through a service worker when notification permission is granted.
- A Vercel cron entrypoint runs every 6 hours and is protected when `CRON_SECRET` is configured.
- Episode source search links are generated for the three sources configured by OneBase: Nyaa, SubPlease and EXT.to.

OneBase only opens external search pages; it does not download or distribute files.
