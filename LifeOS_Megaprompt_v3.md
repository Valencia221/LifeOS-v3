# LifeOS — Megaprompt Técnico (v3)

> Copia y pega TODO lo que está debajo de la línea en tu modelo de IA.
> v3 corrige la capa de base de datos, la encriptación, la config de Tauri 2.x,
> la sincronización FTS5 y añade criterios de aceptación y reglas de entrega.

---

## MEGAPROMPT TÉCNICO — LIFEOS v3

### 0. ROL Y CONTEXTO

Actúa como un **arquitecto de software senior** especializado en aplicaciones **desktop local-first** con **Tauri 2.x, Rust y React**. Tienes experiencia real con `rusqlite`, SQLCipher, pools de conexiones, el sistema de capabilities/permissions de Tauri 2 y empaquetado multiplataforma.

Vas a diseñar y codificar el andamiaje **completo y funcional** de una app de organización personal llamada **LifeOS** (inspirada en Notion + Obsidian). La app:

- Funciona **100% offline**, sin servidores ni telemetría.
- Guarda todo en la máquina del usuario en una **base SQLite encriptada con SQLCipher**.
- Es **multiplataforma**: Windows, macOS y Linux.
- Tiene tres módulos: **Notas**, **Tareas/Calendario** y **Finanzas**.

Principios no negociables: local-first, cifrado en reposo, sin dependencias de red en runtime, código tipado y listo para producción.

---

### 0.1 REGLAS DE ENTREGA (cómo debes responder)

1. **Entrega archivo por archivo**, cada uno con un encabezado que indique su **ruta completa** (ej. `// src-tauri/src/db.rs`).
2. **Código completo**: prohibido `// ...`, `TODO`, `unimplemented!()`, stubs o "resto igual". Si un archivo es largo, escríbelo entero sin resumir.
3. Usa **exactamente** las versiones y firmas indicadas. Si una versión exacta de un crate es incompatible, ajústala a la combinación compatible más cercana y **decláralo** en una nota al inicio.
4. Antes del código, lista en 3-5 viñetas las **suposiciones** que tomaste.
5. Al final, incluye una sección **"Cómo ejecutar"** (instalar deps, `dev`, `build` por plataforma) y la lista de prerequisitos (Rust stable, Node ≥ 18, toolchain de cada SO).
6. No uses `.unwrap()` ni `.expect()` en rutas de comandos en runtime: propaga errores con `?` y el tipo `AppError`.

---

### 1. STACK TÉCNICO OBLIGATORIO

**Frontend**
- React 18 + TypeScript 5 + Tailwind CSS v3
- Vite 5 (bundler)
- Zustand (estado global, organizado en slices)
- TipTap 2 (editor de bloques; `StarterKit`; export a Markdown)
- Recharts (gráfica de barras del dashboard de finanzas)

**Backend desktop (Tauri 2.x / Rust)**
- `tauri` 2.x
- Plugins Tauri 2: `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-opener`
- **Base de datos**: `rusqlite` con feature `bundled-sqlcipher` (NO `tauri-plugin-sql`)
- **Pool**: `r2d2` + `r2d2_sqlite` (usar versiones compatibles entre sí y con `rusqlite`)
- **Encriptación**: SQLCipher (AES-256). La clave es de 32 bytes derivada de la contraseña del usuario con **Argon2id** y se pasa como **clave cruda** (`PRAGMA key = "x'<hex>'"`) para que SQLCipher omita su propio KDF.
- `serde` + `serde_json`, `uuid` (v4), `argon2`, `rand`, `thiserror`, `zeroize`, `chrono`

> **Decisión clave (corrige v2):** se elimina `tauri-plugin-sql`. Es incompatible con la integración limpia de SQLCipher y duplicaría el manejo del pool. Toda la DB se gestiona manualmente con `rusqlite` + `r2d2`.

> **Concurrencia (importante):** las llamadas de `rusqlite` son **bloqueantes**. Dentro de cada `#[tauri::command] async`, todo el trabajo de DB debe ejecutarse en `tokio::task::spawn_blocking`, clonando el `DbPool` (que es `Clone + Send + Sync`). No bloquees el runtime async.

---

### 2. SEGURIDAD Y ENCRIPTACIÓN (implementar con cuidado)

1. **Derivación de clave**: Argon2id con parámetros explícitos (sugerido: `m_cost = 19456 KiB`, `t_cost = 2`, `p_cost = 1`, salida de 32 bytes). Deriva una clave de 32 bytes y conviértela a 64 caracteres hex.
2. **Salt fuera de la DB**: el salt **no puede vivir dentro de la base encriptada** (se necesita antes de desencriptar). Guárdalo en un sidecar en texto plano junto a la DB:
   - Archivo `lifeos.salt.json` en el `app_data_dir` con: `{ version, salt_b64, argon2_params }`.
   - **Nunca** guardes la contraseña ni la clave derivada en disco.
3. **Primer arranque (setup)**: genera salt aleatorio de 16 bytes (`rand`), escribe el sidecar, deriva la clave, crea la DB encriptada y corre migraciones.
4. **Verificación de contraseña**: al desbloquear, abre la conexión con la clave derivada y ejecuta `SELECT count(*) FROM sqlite_master`. Si falla → contraseña incorrecta (no se guarda hash aparte; SQLCipher es la verificación).
5. **Memoria**: usa `zeroize` para limpiar buffers de contraseña/clave tras usarlos.
6. **Estado de la app**: la DB arranca **bloqueada**. Mantén el pool detrás de un lock opcional, p. ej. `struct DbState(Mutex<Option<DbPool>>)` gestionado con `app.manage(...)`. Los comandos de datos devuelven `AppError::Locked` si el pool aún no está inicializado.

---

### 3. ESQUEMA DE BASE DE DATOS (implementar exactamente)

Aplicar como **migración v1** dentro de una transacción y registrar en `schema_migrations`.

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id           TEXT PRIMARY KEY,            -- UUID v4
  title        TEXT NOT NULL DEFAULT '',
  content_md   TEXT NOT NULL DEFAULT '',    -- Markdown serializado desde TipTap
  content_json TEXT,                        -- JSON de bloques TipTap (re-edición)
  tags         TEXT NOT NULL DEFAULT '[]',  -- JSON array de strings
  is_deleted   INTEGER NOT NULL DEFAULT 0,  -- Soft delete
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    TEXT,                          -- ISO 8601
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
  date        TEXT NOT NULL,                 -- YYYY-MM-DD
  note_id     TEXT REFERENCES notes(id),
  is_deleted  INTEGER NOT NULL DEFAULT 0,    -- consistencia con notes/tasks
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notes_updated   ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_due        ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);

-- Triggers para updated_at (no depender del código de la app)
CREATE TRIGGER IF NOT EXISTS trg_notes_updated
AFTER UPDATE ON notes FOR EACH ROW
BEGIN UPDATE notes SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_updated
AFTER UPDATE ON tasks FOR EACH ROW
BEGIN UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_tx_updated
AFTER UPDATE ON transactions FOR EACH ROW
BEGIN UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id; END;

-- Búsqueda full-text. NO usar external-content: las id son TEXT (UUID),
-- y external-content de FTS5 requiere rowid INTEGER. Usar tabla normal
-- mantenida por triggers, con note_id como columna no indexada.
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
```

> `search_notes` debe hacer `JOIN notes` por `note_id` y filtrar `notes.is_deleted = 0`, de modo que las notas en papelera no aparezcan aunque sigan en el índice.

**Migraciones**: implementar un runner idempotente en `db.rs` que: lea la versión actual de `schema_migrations`, aplique en orden las migraciones pendientes (cada una en su propia transacción) y registre la versión. La migración v1 es el bloque SQL de arriba.

---

### 4. MANEJO DE ERRORES (tipo compartido en todos los comandos)

Define un enum `AppError` con `thiserror` que implemente `serde::Serialize`, para que cruce el IPC como un objeto estructurado `{ code, message }`. Todos los comandos devuelven `Result<T, AppError>`.

```rust
// src-tauri/src/error.rs
#[derive(Debug, thiserror::Error)]
pub enum AppError {
  #[error("base de datos bloqueada")] Locked,
  #[error("contraseña incorrecta")]   WrongPassword,
  #[error("no encontrado: {0}")]      NotFound(String),
  #[error("error de base de datos: {0}")] Db(String),
  #[error("error de IO: {0}")]        Io(String),
  #[error("error interno: {0}")]      Internal(String),
}
// Implementar serde::Serialize -> { "code": "Locked"|..., "message": "..." }
// Implementar From<rusqlite::Error>, From<r2d2::Error>, From<std::io::Error>, etc.
```

---

### 5. COMANDOS TAURI (Rust) — implementar todos

Cada comando: `async`, retorno `Result<T, AppError>`, trabajo de DB dentro de `spawn_blocking` con el `DbPool` clonado, sin `unwrap`.

**Auth / DB (`src-tauri/src/commands/auth.rs`)**
```rust
#[tauri::command] async fn is_first_run(state: State<DbState>) -> Result<bool, AppError>
#[tauri::command] async fn setup_db(name: String, password: String, state: State<DbState>) -> Result<(), AppError>
#[tauri::command] async fn unlock_db(password: String, state: State<DbState>) -> Result<(), AppError>
#[tauri::command] async fn lock_db(state: State<DbState>) -> Result<(), AppError>
```

**Notas (`src-tauri/src/commands/notes.rs`)**
```rust
#[tauri::command] async fn get_notes(state: State<DbState>) -> Result<Vec<Note>, AppError>
#[tauri::command] async fn get_note(id: String, state: State<DbState>) -> Result<Note, AppError>
#[tauri::command] async fn save_note(note: NoteInput, state: State<DbState>) -> Result<Note, AppError>   // upsert por id
#[tauri::command] async fn delete_note(id: String, state: State<DbState>) -> Result<(), AppError>        // soft delete
#[tauri::command] async fn search_notes(query: String, state: State<DbState>) -> Result<Vec<NotePreview>, AppError> // FTS5 + filtro is_deleted=0
```

**Tareas (`src-tauri/src/commands/tasks.rs`)**
```rust
#[tauri::command] async fn get_tasks(filter: TaskFilter, state: State<DbState>) -> Result<Vec<Task>, AppError>
#[tauri::command] async fn create_task(task: TaskInput, state: State<DbState>) -> Result<Task, AppError>
#[tauri::command] async fn update_task(task: TaskInput, state: State<DbState>) -> Result<Task, AppError>
#[tauri::command] async fn update_task_status(id: String, status: String, state: State<DbState>) -> Result<(), AppError>
#[tauri::command] async fn delete_task(id: String, state: State<DbState>) -> Result<(), AppError>
```

**Finanzas (`src-tauri/src/commands/finance.rs`)**
```rust
#[tauri::command] async fn add_transaction(tx: TransactionInput, state: State<DbState>) -> Result<Transaction, AppError>
#[tauri::command] async fn get_transactions(month: String, state: State<DbState>) -> Result<Vec<Transaction>, AppError> // "YYYY-MM"
#[tauri::command] async fn get_monthly_summary(month: String, state: State<DbState>) -> Result<MonthlySummary, AppError>
#[tauri::command] async fn export_transactions_csv(month: String, app: AppHandle, state: State<DbState>) -> Result<String, AppError> // abre diálogo de guardado; escribe CSV con escape correcto; retorna path
```

**DB (`src-tauri/src/db.rs`)**
```rust
pub fn build_pool(db_path: &Path, raw_key_hex: &str) -> Result<DbPool, AppError> // r2d2 + PRAGMA key
pub fn run_migrations(conn: &Connection) -> Result<(), AppError>
pub fn derive_key(password: &str, salt: &[u8]) -> Result<String, AppError>       // Argon2id -> 64 hex chars
```

Registra todos los comandos en el `invoke_handler` de `main.rs`/`lib.rs`.

---

### 6. TIPOS COMPARTIDOS (TypeScript ↔ Rust deben coincidir)

Mismos nombres de campo en `snake_case` en ambos lados. Los structs de Rust derivan `Serialize, Deserialize`.

```typescript
// src/types/index.ts

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type Priority   = 'low' | 'medium' | 'high';
export type TxType     = 'income' | 'expense';

export interface Note {
  id: string;
  title: string;
  content_md: string;
  content_json: string | null;
  tags: string[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotePreview {
  id: string;
  title: string;
  snippet: string;       // extracto resaltado del FTS
  updated_at: string;
}

export interface NoteInput {
  id: string | null;     // null => nueva (genera UUID en Rust)
  title: string;
  content_md: string;
  content_json: string | null;
  tags: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: Priority;
  note_id: string | null;
  is_deleted: boolean;   // (corrige v2: faltaba)
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: Priority;
  note_id: string | null;
}

export interface TaskFilter {
  status: TaskStatus | null;
  from: string | null;   // ISO date
  to: string | null;     // ISO date
  include_deleted: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TxType;
  category: string;
  description: string | null;
  date: string;          // YYYY-MM-DD
  note_id: string | null;
  is_deleted: boolean;   // (corrige v2: ahora consistente)
  created_at: string;
  updated_at: string;
}

export interface TransactionInput {
  id: string | null;
  amount: number;
  type: TxType;
  category: string;
  description: string | null;
  date: string;
  note_id: string | null;
}

export interface MonthlySummary {
  month: string;
  total_income: number;
  total_expenses: number;
  balance: number;
  by_category: { category: string; total: number; type: TxType }[];
}

export interface AppError {  // forma serializada del enum de Rust
  code: string;
  message: string;
}
```

---

### 7. CAPA DE SERVICIOS FRONTEND (wrapper tipado de IPC)

```typescript
// src/services/notesService.ts
// Reglas:
// 1. invoke<T>('command_name', payload)
// 2. Capturar el AppError serializado y relanzarlo como Error JS legible
// 3. Funciones async puras, sin estado
import { invoke } from '@tauri-apps/api/core';   // Tauri 2.x: '@tauri-apps/api/core'
import type { Note, NoteInput, NotePreview } from '../types';

function toError(e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) return new Error(String((e as any).message));
  return new Error(String(e));
}

export const getNotes = async (): Promise<Note[]> => {
  try { return await invoke<Note[]>('get_notes'); }
  catch (e) { throw toError(e); }
};
// Repetir el patrón para el resto de notes, tasks, finance y auth.
```

---

### 8. STORE ZUSTAND

```typescript
// src/store/useAppStore.ts
// Un único store con slices:
// - auth:    { isFirstRun, isUnlocked, setUnlocked }
// - ui:      { activeView, sidebarCollapsed, toggleSidebar, setView }
// - notes:   { notes, activeNoteId, loadNotes, upsertNote, removeNote }
// - tasks:   { tasks, loadTasks, upsertTask, setStatus, removeTask }
// - finance: { month, transactions, summary, loadMonth }
// Las acciones llaman a los services; el store no toca invoke() directamente.
```

---

### 9. COMPONENTES UI (Tailwind, tema oscuro tipo Obsidian)

Paleta: fondo `#1e1e2e`, sidebar `#181825`, acento `#89b4fa`, texto `#cdd6f4`.

- **`<LockScreen />`**: si ya existe DB pero está bloqueada, pide contraseña y llama `unlock_db`. Maneja error de contraseña incorrecta.
- **`<OnboardingModal />`**: primer arranque. Pide nombre y contraseña (con confirmación). Advierte que la contraseña es permanente y desencripta la BD. Llama `setup_db`.
- **`<Sidebar />`**: navegación (Notas, Calendario, Finanzas, Configuración) con íconos; colapsable.
- **`<NoteEditor />`**: TipTap con barra de formato (negrita, cursiva, headings, listas, bloque de código). Autosave con debounce de 800ms vía `save_note`.
- **`<NotesList />`**: búsqueda en tiempo real (FTS5) vía `search_notes`, orden por `updated_at`, filtro por tags.
- **`<CalendarView />`** + **`<TaskPanel />`**: vista mensual con tareas superpuestas; click en un día abre panel lateral con las tareas de ese día.
- **`<FinanceDashboard />`**: resumen mensual con gráfica de barras (Recharts: ingresos vs gastos), lista de transacciones y botón "Exportar CSV".

Requisitos transversales: estados de carga/error visibles, navegación por teclado básica, y que ningún componente llame `invoke` directamente (usar services + store).

---

### 10. BUILD MULTIPLATAFORMA (Tauri 2.x)

**`package.json`**
```json
{
  "scripts": {
    "dev:vite": "vite",
    "build:vite": "tsc && vite build",
    "dev": "tauri dev",
    "build:desktop": "tauri build",
    "postbuild:desktop": "node scripts/copy-dist.mjs"
  }
}
```

**`scripts/copy-dist.mjs`** (Node ≥ 16.7, sin bash)
```javascript
import { cp, mkdir } from 'fs/promises';
import { join } from 'path';
const src = join('src-tauri', 'target', 'release', 'bundle');
const dest = join('dist-app');
await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log('✓ dist-app/ creada con los ejecutables.');
```

**`src-tauri/tauri.conf.json`** (esquema correcto de Tauri 2.x — `identifier` y `bundle` van en el nivel superior; ya no hay clave `tauri`):
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "LifeOS",
  "version": "0.1.0",
  "identifier": "com.lifeos.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev:vite",
    "beforeBuildCommand": "npm run build:vite"
  },
  "app": {
    "windows": [
      { "label": "main", "title": "LifeOS", "width": 1200, "height": 800, "resizable": true }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: asset:; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
    "windows": {
      "wix": { "language": "es-ES" },
      "nsis": { "displayLanguageSelector": false }
    }
  }
}
```

**`src-tauri/capabilities/default.json`** (permisos ACL de Tauri 2.x — sin esto los plugins no funcionan):
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Permisos por defecto de LifeOS",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "opener:default"
  ]
}
```

**`src-tauri/Cargo.toml`** (deps con features correctas; ajustar versiones compatibles entre `rusqlite`/`r2d2_sqlite`):
```toml
[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri               = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs     = "2"
tauri-plugin-opener = "2"
rusqlite            = { version = "0.32", features = ["bundled-sqlcipher"] }
r2d2                = "0.8"
r2d2_sqlite         = "0.25"
serde               = { version = "1", features = ["derive"] }
serde_json          = "1"
uuid                = { version = "1", features = ["v4"] }
argon2              = "0.5"
rand                = "0.8"
thiserror           = "1"
zeroize             = "1"
chrono              = { version = "0.4", features = ["serde"] }
```

---

### 11. ESTRUCTURA DE ARCHIVOS DEL MONOREPO

```
lifeos/
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── NoteEditor.tsx
│   │   ├── NotesList.tsx
│   │   ├── CalendarView.tsx
│   │   ├── TaskPanel.tsx
│   │   ├── FinanceDashboard.tsx
│   │   ├── OnboardingModal.tsx
│   │   └── LockScreen.tsx
│   ├── services/
│   │   ├── authService.ts
│   │   ├── notesService.ts
│   │   ├── tasksService.ts
│   │   └── financeService.ts
│   ├── store/useAppStore.ts
│   ├── types/index.ts
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── error.rs
│   │   ├── db.rs
│   │   └── commands/
│   │       ├── mod.rs
│   │       ├── auth.rs
│   │       ├── notes.rs
│   │       ├── tasks.rs
│   │       └── finance.rs
│   ├── capabilities/default.json
│   ├── Cargo.toml
│   └── tauri.conf.json
├── scripts/copy-dist.mjs
├── dist-app/            # generado (gitignore)
├── package.json
└── vite.config.ts
```

---

### 12. CRITERIOS DE ACEPTACIÓN (definición de "hecho")

- `cargo build` compila sin errores y `cargo clippy` no arroja warnings en rutas de comandos.
- Ningún `.unwrap()` / `.expect()` en código de runtime; los errores cruzan el IPC como `AppError`.
- Primer arranque crea el sidecar de salt y una DB **realmente encriptada** (verificable: los primeros bytes del archivo **no** son `SQLite format 3`).
- Contraseña incorrecta en `unlock_db` devuelve `WrongPassword` sin crashear.
- CRUD funciona en los tres módulos. La búsqueda FTS5 refleja cambios al instante (gracias a los triggers) y excluye notas en papelera.
- `get_monthly_summary` calcula correctamente income/expense/balance y el desglose por categoría.
- `export_transactions_csv` produce un CSV válido (con escape de comas/comillas) y retorna el path.
- Documentadas las instrucciones de build para Windows, macOS y Linux.
- **Tests Rust mínimos**: (a) el runner de migraciones es idempotente (correrlo dos veces no falla ni duplica), (b) la agregación de `get_monthly_summary` da el resultado esperado con datos de ejemplo. Incluir al menos un test por caso.

---

### 13. ENTREGABLES EN ORDEN

1. `src-tauri/Cargo.toml`
2. `src-tauri/src/error.rs`
3. `src-tauri/src/db.rs` (pool + SQLCipher + Argon2 + migraciones)
4. `src-tauri/src/commands/{mod,auth,notes,tasks,finance}.rs`
5. `src-tauri/src/{main,lib}.rs` (registro de plugins y comandos)
6. `src-tauri/capabilities/default.json` y `src-tauri/tauri.conf.json`
7. `src/types/index.ts` y `src/services/*.ts`
8. `src/store/useAppStore.ts`
9. Los ocho componentes UI con Tailwind
10. `package.json`, `vite.config.ts` y `scripts/copy-dist.mjs`
11. Tests Rust mínimos + sección "Cómo ejecutar"

Genera el código **modular, tipado y listo para producción**. Comenta solo donde la lógica no sea obvia (derivación de clave, triggers FTS, `spawn_blocking`).
