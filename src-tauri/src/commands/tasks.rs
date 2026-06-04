use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::auth::DbState;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub status: String,
    pub priority: String,
    pub note_id: Option<String>,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct TaskInput {
    pub id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub status: String,
    pub priority: String,
    pub note_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TaskFilter {
    pub status: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub include_deleted: bool,
}

fn get_pool(state: &State<DbState>) -> Result<crate::db::DbPool, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    guard.clone().ok_or(AppError::Locked)
}

fn row_to_task(r: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: r.get(0)?,
        title: r.get(1)?,
        description: r.get(2)?,
        due_date: r.get(3)?,
        status: r.get(4)?,
        priority: r.get(5)?,
        note_id: r.get(6)?,
        is_deleted: r.get::<_, i32>(7)? != 0,
        created_at: r.get(8)?,
        updated_at: r.get(9)?,
    })
}

#[tauri::command]
pub async fn get_tasks(filter: TaskFilter, state: State<'_, DbState>) -> Result<Vec<Task>, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        let mut conditions = vec![];
        if !filter.include_deleted { conditions.push("is_deleted = 0".to_string()); }
        if let Some(ref s) = filter.status { conditions.push(format!("status = '{}'", s)); }
        if let Some(ref f) = filter.from { conditions.push(format!("due_date >= '{}'", f)); }
        if let Some(ref t) = filter.to { conditions.push(format!("due_date <= '{}'", t)); }
        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };
        let sql = format!(
            "SELECT id, title, description, due_date, status, priority, note_id, is_deleted, created_at, updated_at
             FROM tasks {} ORDER BY due_date ASC", where_clause
        );
        let mut stmt = conn.prepare(&sql)?;
        let tasks = stmt.query_map([], row_to_task)?.collect::<Result<Vec<_>, _>>()?;
        Ok(tasks)
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn create_task(task: TaskInput, state: State<'_, DbState>) -> Result<Task, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO tasks(id, title, description, due_date, status, priority, note_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, task.title, task.description, task.due_date, task.status, task.priority, task.note_id],
        )?;
        conn.query_row(
            "SELECT id, title, description, due_date, status, priority, note_id, is_deleted, created_at, updated_at
             FROM tasks WHERE id = ?1", [&id], row_to_task
        ).map_err(|e| AppError::Db(e.to_string()))
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn update_task(task: TaskInput, state: State<'_, DbState>) -> Result<Task, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        let id = task.id.ok_or_else(|| AppError::Internal("id requerido".into()))?;
        conn.execute(
            "UPDATE tasks SET title=?1, description=?2, due_date=?3, status=?4, priority=?5, note_id=?6
             WHERE id=?7",
            rusqlite::params![task.title, task.description, task.due_date, task.status, task.priority, task.note_id, id],
        )?;
        conn.query_row(
            "SELECT id, title, description, due_date, status, priority, note_id, is_deleted, created_at, updated_at
             FROM tasks WHERE id = ?1", [&id], row_to_task
        ).map_err(|_| AppError::NotFound(id))
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn update_task_status(id: String, status: String, state: State<'_, DbState>) -> Result<(), AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        conn.execute("UPDATE tasks SET status=?1 WHERE id=?2", rusqlite::params![status, id])?;
        Ok(())
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn delete_task(id: String, state: State<'_, DbState>) -> Result<(), AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        conn.execute("UPDATE tasks SET is_deleted=1 WHERE id=?1", [&id])?;
        Ok(())
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}
