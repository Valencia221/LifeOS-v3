mod commands;
mod db;
mod error;

use commands::auth::DbState;
use commands::{auth::*, finance::*, notes::*, tasks::*};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(DbState(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            // auth
            is_first_run,
            setup_db,
            unlock_db,
            lock_db,
            // notes
            get_notes,
            get_note,
            save_note,
            delete_note,
            search_notes,
            // tasks
            get_tasks,
            create_task,
            update_task,
            update_task_status,
            delete_task,
            // finance
            add_transaction,
            get_transactions,
            get_monthly_summary,
            export_transactions_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar LifeOS");
}
