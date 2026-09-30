import Database from '@tauri-apps/plugin-sql';

/** Precisa bater com `DB_URL` em src-tauri/src/lib.rs. */
const DB_URL = 'sqlite:app_financeiro.db';

let dbPromise: Promise<Database> | null = null;

/**
 * Conexão única com o SQLite local. `Database.load` dispara as migrations
 * pendentes (definidas em src-tauri/src/lib.rs, SQL em src-tauri/migrations/) na
 * primeira chamada.
 */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}
