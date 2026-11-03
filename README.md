# Zen Unlimited

An offline-friendly, no-build neon arcade game. Collect mint fragments, dodge coral static, and use your dash to stay in the flow.

## Play

Open `index.html` in a modern browser, or serve this folder locally:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. This works in Debian/proot without Node.js, npm packages, API keys, or network access.

## Controls

- **Move:** WASD, arrow keys, or drag with a mouse/finger
- **Dash:** Space (short cooldown; grants a brief safety window)
- **Pause/resume:** Escape or the pause button
- **Sound:** musical-note button in the header

Gather mint fragments for points, pick up a gold pulse to restore a lost life, and avoid coral static. Your best score is saved in browser local storage when available. Difficulty rises as you advance through sectors.

## Notes

The game is implemented with Canvas and vanilla JavaScript; there is no compile step or third-party runtime dependency. OpenCode and usage limits are not modified by the game.
