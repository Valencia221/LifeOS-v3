use std::fs;
use std::path::PathBuf;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use zeroize::Zeroizing;

use crate::db::{build_pool, derive_key, run_migrations, DbPool};
use crate::error::AppError;

pub struct DbState(pub std::sync::Mutex<Option<DbPool>>);

#[derive(Serialize, Deserialize)]
struct SaltFile {
    version: u8,
    salt_b64: String,
    argon2_params: ArgonParams,
}

#[derive(Serialize, Deserialize)]
struct ArgonParams {
    m_cost: u32,
    t_cost: u32,
    p_cost: u32,
}

fn db_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app.path().app_data_dir().map_err(|e| AppError::Io(e.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir.join("lifeos.db"))
}

fn salt_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app.path().app_data_dir().map_err(|e| AppError::Io(e.to_string()))?;
    Ok(dir.join("lifeos.salt.json"))
}

#[tauri::command]
pub async fn is_first_run(app: AppHandle) -> Result<bool, AppError> {
    let sp = salt_path(&app)?;
    Ok(!sp.exists())
}

#[tauri::command]
pub async fn setup_db(
    name: String,
    password: String,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<(), AppError> {
    let sp = salt_path(&app)?;
    let dp = db_path(&app)?;

    // Genera salt aleatorio de 16 bytes
    let mut salt_bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt_bytes);

    let salt_file = SaltFile {
        version: 1,
        salt_b64: B64.encode(salt_bytes),
        argon2_params: ArgonParams { m_cost: 19456, t_cost: 2, p_cost: 1 },
    };
    fs::write(&sp, serde_json::to_string(&salt_file)?)?;

    let password = Zeroizing::new(password);
    let key = Zeroizing::new(derive_key(&password, &salt_bytes)?);

    let pool = tokio::task::spawn_blocking({
        let dp = dp.clone();
        let key = key.clone();
        move || build_pool(&dp, &key)
    }).await.map_err(|e| AppError::Internal(e.to_string()))??;

    // Corre migraciones
    {
        let conn = pool.get()?;
        run_migrations(&conn)?;
        // Guarda nombre de usuario en config
        conn.execute(
            "INSERT OR REPLACE INTO app_config(key,value) VALUES ('user_name', ?1)",
            [&name],
        )?;
    }

    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    *guard = Some(pool);
    Ok(())
}

#[tauri::command]
pub async fn unlock_db(
    password: String,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<(), AppError> {
    let sp = salt_path(&app)?;
    let dp = db_path(&app)?;

    let salt_raw = fs::read_to_string(&sp).map_err(|_| AppError::WrongPassword)?;
    let salt_file: SaltFile = serde_json::from_str(&salt_raw)?;
    let salt_bytes = B64.decode(&salt_file.salt_b64)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let password = Zeroizing::new(password);
    let key = Zeroizing::new(derive_key(&password, &salt_bytes)?);

    let pool = tokio::task::spawn_blocking({
        let dp = dp.clone();
        let key = key.clone();
        move || build_pool(&dp, &key)
    }).await.map_err(|e| AppError::Internal(e.to_string()))??;

    // Verificación: si la contraseña es incorrecta, SQLCipher lanzará error aquí
    {
        let conn = pool.get()?;
        conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))
            .map_err(|_| AppError::WrongPassword)?;
    }

    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    *guard = Some(pool);
    Ok(())
}

#[tauri::command]
pub async fn lock_db(state: State<'_, DbState>) -> Result<(), AppError> {
    let mut guard = state.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    *guard = None;
    Ok(())
}
