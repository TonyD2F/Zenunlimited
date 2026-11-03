# Zen Arcade

A no-build, offline-friendly arcade with three neon, 3D-style canvas games: **Neon Rush**, **Star Blaster**, and **Crystal Sprint**. It uses only local HTML, CSS, and JavaScript—no third-party runtime dependencies, accounts, ads, or network calls.

## Play

You can open `index.html` directly for a quick game. To enable installability and offline caching, serve the folder over HTTP (service workers require a secure context; `localhost` is treated as secure):

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>, then load it once while online/connected to the local server. The service worker caches the app shell so it can be reopened offline. Gameplay, sound effects, and best scores work locally; best scores are saved in this browser's local storage.

## Install on Android

1. Open the hosted app URL in Chrome while connected and wait for the page to load.
2. Tap **＋ INSTALL** if it appears, or open Chrome's menu and choose **Install app** / **Add to Home screen**.
3. Launch Zen Arcade from the home screen. After the first successful load, the cached app shell and all three games are available offline.

For installation on other devices, publish these static files to an HTTPS host, then use the browser's install or add-to-home-screen command. Opening the HTML with `file://` supports play, but not service-worker caching or PWA installation.

## Controls

- **Move / change lanes:** ← / →, A / D, or the on-screen arrow buttons
- **Action:** Space, ↑, W, or the on-screen action button (dash, fire, or jump depending on the game)
- **Pause / resume:** Esc or the pause button
- **Start / play again:** Start button or Enter
- **Sound:** musical-note button in the header

## Files

- `index.html`, `style.css`, `game.js` — the arcade and games
- `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png` — install metadata and app icons
- `sw.js` — app-shell caching for offline launches
