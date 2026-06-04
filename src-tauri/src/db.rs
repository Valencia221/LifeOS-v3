use std::path::Path;
use rusqlite::Connection;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use argon2::{Argon2, Params, Algorithm, Version};
use zeroize::Zeroizing;
use crate::error::AppError;

pub type DbPool = Pool<SqliteConnectionManager>;

/// Deriva una clave de 32 bytes con Argon2id y la retorna como 64 chars hex.
/// El buffer de clave se limpia con zeroize tras la conversión.
pub fn derive_key(password: &str, salt: &[u8]) -> Result<String, AppError> {
    let params = Params::new(19456, 2, 1, Some(32))
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0u8; 32]);
    argon2
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let hex = key.iter().map(|b| format!("{:02x}", b)).collect::<String>();
    Ok(hex)
}

/// Abre el pool con SQLCipher usando clave cruda (hex).
pub fn build_pool(db_path: &Path, raw_key_hex: &str) -> Result<DbPool, AppError> {
    let key_pragma = format!("PRAGMA key = \"x'{}'\"", raw_key_hex);
    let manager = SqliteConnectionManager::file(db_path).with_init(move |conn| {
        conn.execute_batch(&key_pragma)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(())
    });
    let pool = Pool::builder()
        .max_size(4)
        .build(manager)
        .map_err(|e| AppError::Db(e.to_string()))?;
    Ok(pool)
}

/// Runner de migraciones idempotente.
pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
           version    INTEGER PRIMARY KEY,
           applied_at TEXT NOT NULL DEFAULT (datetime('now'))
         );"
    )?;
    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if current < 1 {
        conn.execute_batch(MIGRATION_V1)?;
        conn.execute("INSERT INTO schema_migrations(version) VALUES (1)", [])?;
    }
    Ok(())
}

const MIGRATION_V1: &str = "
CREATE TABLE IF NOT EXISTS notes (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT '',
  content_md   TEXT NOT NULL DEFAULT '',
  content_json TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',
  is_deleted   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','in_progress','done','cancelled')),
  priority    TEXT NOT NULL DEFAULT 'medium'
                CHECK(priority IN ('low','medium','high')),
  note_id     TEXT REFERENCES notes(id),
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  amount      REAL NOT NULL CHECK(amount >= 0),
  type        TEXT NOT NULL CHECK(type IN ('income','expense')),
  category    TEXT NOT NULL,
  description TEXT,
  date        TEXT NOT NULL,
  note_id     TEXT REFERENCES notes(id),
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_updated    ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_due        ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);

CREATE TRIGGER IF NOT EXISTS trg_notes_updated
AFTER UPDATE ON notes FOR EACH ROW
BEGIN UPDATE notes SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_updated
AFTER UPDATE ON tasks FOR EACH ROW
BEGIN UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_tx_updated
AFTER UPDATE ON transactions FOR EACH ROW
BEGIN UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  note_id UNINDEXED,
  title,
  content_md
);

CREATE TRIGGER IF NOT EXISTS trg_notes_fts_ai
AFTER INSERT ON notes FOR EACH ROW BEGIN
  INSERT INTO notes_fts(note_id, title, content_md)
  VALUES (NEW.id, NEW.title, NEW.content_md);
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_fts_ad
AFTER DELETE ON notes FOR EACH ROW BEGIN
  DELETE FROM notes_fts WHERE note_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_fts_au
AFTER UPDATE ON notes FOR EACH ROW BEGIN
  UPDATE notes_fts SET title = NEW.title, content_md = NEW.content_md
  WHERE note_id = NEW.id;
END;
";

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn open_test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn migrations_are_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        // Segunda ejecucion no debe fallar ni duplicar
        run_migrations(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn monthly_summary_aggregation() {
        let conn = open_test_conn();
        conn.execute_batch(
            "INSERT INTO transactions(id,amount,type,category,date) VALUES
             ('t1', 1000.0, 'income',  'Salario',  '2024-03-01'),
             ('t2',  200.0, 'expense', 'Comida',   '2024-03-05'),
             ('t3',  300.0, 'expense', 'Transporte','2024-03-10'),
             ('t4',  500.0, 'income',  'Freelance','2024-03-15');",
        ).unwrap();

        let total_income: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount),0) FROM transactions
                  WHERE type='income' AND strftime('%Y-%m',date)='2024-03' AND is_deleted=0",
                [], |r| r.get(0),
            ).unwrap();
        let total_expense: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount),0) FROM transactions
                  WHERE type='expense' AND strftime('%Y-%m',date)='2024-03' AND is_deleted=0",
                [], |r| r.get(0),
            ).unwrap();

        assert!((total_income - 1500.0).abs() < 0.001);
        assert!((total_expense - 500.0).abs() < 0.001);
        assert!((total_income - total_expense - 1000.0).abs() < 0.001);
    }
}
