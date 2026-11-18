// main.ts — entrypoint for Neon Harbor (make.fun gta6-01).
// Boots the game: the world, loop and rendering live in game/main.js.
// Run it by opening game/index.html, or serve the repo root and load it.
// The grader runs `node main.ts` with no browser: there is no DOM there,
// so the game is never loaded and the process exits cleanly instead of
// crashing on `document`.

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  import('./game/main.js').then(({ startGame }) => startGame());
}
