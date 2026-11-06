import {databaseMode} from './database-mode.mjs';

// Fail fast before importing server modules or touching local storage.
// In production, a missing DATABASE_URL must never fall back to SQLite.
databaseMode(process.env);
await import('./index.mjs');
