use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::auth::DbState;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content_md: String,
    pub content_json: Option<String>,
    pub tags: Vec<String>,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NotePreview {
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NoteInput {
    pub id: Option<String>,
    pub title: String,
    pub content_md: String,
    pub content_json: Option<String>,
    pub tags: Vec<String>,
}

fn get_pool(state: &State<DbState>) -> Result<crate::db::DbPool, AppError> {
    let guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    guard.clone().ok_or(AppError::Locked)
}

#[tauri::command]
pub async fn get_notes(state: State<'_, DbState>) -> Result<Vec<Note>, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, title, content_md, content_json, tags, is_deleted, created_at, updated_at
             FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC"
        )?;
        let notes = stmt.query_map([], |r| {
            let tags_str: String = r.get(4)?;
            Ok(Note {
                id: r.get(0)?,
                title: r.get(1)?,
                content_md: r.get(2)?,
                content_json: r.get(3)?,
                tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                is_deleted: r.get::<_, i32>(5)? != 0,
                created_at: r.get(6)?,
                updated_at: r.get(7)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(notes)
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn get_note(id: String, state: State<'_, DbState>) -> Result<Note, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        conn.query_row(
            "SELECT id, title, content_md, content_json, tags, is_deleted, created_at, updated_at
             FROM notes WHERE id = ?1",
            [&id],
            |r| {
                let tags_str: String = r.get(4)?;
                Ok(Note {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    content_md: r.get(2)?,
                    content_json: r.get(3)?,
                    tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                    is_deleted: r.get::<_, i32>(5)? != 0,
                    created_at: r.get(6)?,
                    updated_at: r.get(7)?,
                })
            }
        ).map_err(|_| AppError::NotFound(id))
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn save_note(note: NoteInput, state: State<'_, DbState>) -> Result<Note, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        let id = note.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let tags_json = serde_json::to_string(&note.tags).unwrap_or_else(|_| "[]".into());
        conn.execute(
            "INSERT INTO notes(id, title, content_md, content_json, tags)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
               title        = excluded.title,
               content_md   = excluded.content_md,
               content_json = excluded.content_json,
               tags         = excluded.tags",
            rusqlite::params![id, note.title, note.content_md, note.content_json, tags_json],
        )?;
        conn.query_row(
            "SELECT id, title, content_md, content_json, tags, is_deleted, created_at, updated_at
             FROM notes WHERE id = ?1",
            [&id],
            |r| {
                let tags_str: String = r.get(4)?;
                Ok(Note {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    content_md: r.get(2)?,
                    content_json: r.get(3)?,
                    tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                    is_deleted: r.get::<_, i32>(5)? != 0,
                    created_at: r.get(6)?,
                    updated_at: r.get(7)?,
                })
            }
        ).map_err(|e| AppError::Db(e.to_string()))
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn delete_note(id: String, state: State<'_, DbState>) -> Result<(), AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        conn.execute("UPDATE notes SET is_deleted = 1 WHERE id = ?1", [&id])?;
        Ok(())
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn search_notes(query: String, state: State<'_, DbState>) -> Result<Vec<NotePreview>, AppError> {
    let pool = get_pool(&state)?;
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        let fts_query = format!("{}*", query);
        let mut stmt = conn.prepare(
            "SELECT n.id, n.title, snippet(notes_fts, 2, '<b>', '</b>', '...', 20) AS snippet, n.updated_at
             FROM notes_fts
             JOIN notes n ON notes_fts.note_id = n.id
             WHERE notes_fts MATCH ?1 AND n.is_deleted = 0
             ORDER BY n.updated_at DESC
             LIMIT 50"
        )?;
        let previews = stmt.query_map([&fts_query], |r| {
            Ok(NotePreview {
                id: r.get(0)?,
                title: r.get(1)?,
                snippet: r.get(2)?,
                updated_at: r.get(3)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(previews)
    }).await.map_err(|e| AppError::Internal(e.to_string()))?
}
