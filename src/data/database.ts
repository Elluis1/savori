import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  servings INTEGER NOT NULL DEFAULT 1,
  difficulty TEXT NOT NULL DEFAULT 'easy',
  prep_minutes INTEGER NOT NULL DEFAULT 0,
  cook_minutes INTEGER NOT NULL DEFAULT 0,
  cover_image_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredient_groups (
  id TEXT PRIMARY KEY NOT NULL,
  recipe_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  note TEXT,
  optional INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES ingredient_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY NOT NULL,
  recipe_id TEXT NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id TEXT PRIMARY KEY NOT NULL,
  recipe_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  duration_minutes INTEGER,
  tip TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  recipe_id TEXT,
  step_id TEXT,
  type TEXT NOT NULL,
  original_path TEXT NOT NULL,
  compressed_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  byte_size INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES recipe_steps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ingredient_groups_recipe ON ingredient_groups(recipe_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_group ON ingredients(group_id);
CREATE INDEX IF NOT EXISTS idx_tools_recipe ON tools(recipe_id);
CREATE INDEX IF NOT EXISTS idx_steps_recipe ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_media_step ON media_assets(step_id);
CREATE INDEX IF NOT EXISTS idx_media_recipe ON media_assets(recipe_id);
`;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('savori.db');
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}
