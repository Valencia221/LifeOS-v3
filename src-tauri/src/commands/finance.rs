use std::fs;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::commands::auth::DbState;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transaction {
    pub id: String,
    pub amount: f64,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub category: String,
    pub description: Option<String>,
    pub date: String,
    pub note_id: Option<String>,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct TransactionInput {
    pub id: Option<String>,
    pub amount: f64,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub category: String,
    pub description: Option<String>,
    pub date: String,
    pub note_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CategoryBreakdown {
    pub category: String,
    pub total: f64,
    #[serde(rename = "type")]
    pub tx_type: String,
}

#[derive(Debug, Serialize)]
pub struct MonthlySummary {
    pub month: String,
    pub total_income: f64,
    pub total_expenses: f64,
    pub balance: f64,
    pub by_category: Vec<CategoryBreakdown>,
}

fn get_pool(state: &State<DbState>) -> Result<crate::db::DbPool, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    guard.clone().ok_or(AppError::Locked)
}

fn row_to_tx(r: &rusqlite::Row) -> rusqlite::Result<Transaction> {
    Ok(Transaction {
        id: r.get(0)?,
        amount: r.get(1)?,
        tx_type: r.get(2)?,
        category: r.get(3)?,
        description: r.get(4)?,
        date: r.get(5)?,
        note_id: r.get(6)?,
        is_deleted: r.get::<_, i32>(7)? != 0,
        created_at: r.get(8)?,
        updated_at: r.get(9)?,
    })
}

#[tauri::command]
pub async fn add_transaction(tx: TransactionInput, state: State<'_, DbState>) -> Result<Transaction, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        let id = tx.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        conn.execute(
            "INSERT INTO transactions(id, amount, type, category, description, date, note_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
               amount=excluded.amount, type=excluded.type, category=excluded.category,
               description=excluded.description, date=excluded.date, note_id=excluded.note_id",
            rusqlite::params![id, tx.amount, tx.tx_type, tx.category, tx.description, tx.date, tx.note_id],
        )?;
        conn.query_row(
            "SELECT id, amount, type, category, description, date, note_id, is_deleted, created_at, updated_at
             FROM transactions WHERE id=?1", [&id], row_to_tx
        ).map_err(|e| AppError::Db(e.to_string()))
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn get_transactions(month: String, state: State<'_, DbState>) -> Result<Vec<Transaction>, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, amount, type, category, description, date, note_id, is_deleted, created_at, updated_at
             FROM transactions
             WHERE strftime('%Y-%m', date) = ?1 AND is_deleted = 0
             ORDER BY date DESC"
        )?;
        let txs = stmt.query_map([&month], row_to_tx)?.collect::<Result<Vec<_>, _>>()?;
        Ok(txs)
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn get_monthly_summary(month: String, state: State<'_, DbState>) -> Result<MonthlySummary, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount),0) FROM transactions
             WHERE type='income' AND strftime('%Y-%m',date)=?1 AND is_deleted=0",
            [&month], |r| r.get(0),
        )?;
        let total_expenses: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount),0) FROM transactions
             WHERE type='expense' AND strftime('%Y-%m',date)=?1 AND is_deleted=0",
            [&month], |r| r.get(0),
        )?;
        let mut stmt = conn.prepare(
            "SELECT category, type, COALESCE(SUM(amount),0) as total
             FROM transactions
             WHERE strftime('%Y-%m',date)=?1 AND is_deleted=0
             GROUP BY category, type
             ORDER BY total DESC"
        )?;
        let by_category = stmt.query_map([&month], |r| {
            Ok(CategoryBreakdown {
                category: r.get(0)?,
                tx_type: r.get(1)?,
                total: r.get(2)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(MonthlySummary {
            month: month.clone(),
            total_income,
            total_expenses,
            balance: total_income - total_expenses,
            by_category,
        })
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn export_transactions_csv(
    month: String,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<String, AppError> {
    let pool = get_pool(&state)?;
    let txs: Vec<Transaction> = tokio::task::spawn_blocking({
        let month = month.clone();
        move || {
            let conn = pool.get()?;
            let mut stmt = conn.prepare(
                "SELECT id, amount, type, category, description, date, note_id, is_deleted, created_at, updated_at
                 FROM transactions WHERE strftime('%Y-%m',date)=?1 AND is_deleted=0 ORDER BY date"
            )?;
            stmt.query_map([&month], row_to_tx)?.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
        }
    }).await.map_err(|e| AppError::Internal(e.to_string()))??;

    // Construye el CSV con escape correcto
    let mut csv = String::from("id,amount,type,category,description,date\n");
    for tx in &txs {
        let desc = tx.description.as_deref().unwrap_or("");
        csv.push_str(&format!(
            "{},{},{},{},{},{}\n",
            csv_escape(&tx.id),
            tx.amount,
            csv_escape(&tx.tx_type),
            csv_escape(&tx.category),
            csv_escape(desc),
            csv_escape(&tx.date),
        ));
    }

    // Diálogo de guardado
    let save_path = tauri_plugin_dialog::DialogExt::dialog(&app)
        .file()
        .set_title("Exportar transacciones")
        .set_file_name(&format!("lifeos_transactions_{}.csv", month))
        .blocking_save_file();

    match save_path {
        Some(path) => {
            let path_str = path.to_string();
            fs::write(&path_str, csv)?;
            Ok(path_str)
        }
        None => Err(AppError::Internal("Exportación cancelada".into())),
    }
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}
