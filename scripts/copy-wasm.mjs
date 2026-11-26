import { copyFileSync } from 'node:fs';
// Vite serves public/ during development and copies it into dist/ on build.
// Keep the binary paired with the installed sql.js JavaScript in both modes.
copyFileSync('node_modules/sql.js/dist/sql-wasm.wasm', 'public/sql-wasm.wasm');
