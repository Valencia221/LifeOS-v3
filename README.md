# LifeOS v3

App de organización personal **local-first** construida con Tauri 2.x, Rust y React.  
Todos los datos se almacenan en una **base SQLite encriptada con SQLCipher (AES-256)** en tu máquina. Sin servidores, sin telemetría.

## Módulos
- **Notas** — Editor de bloques TipTap con autosave, búsqueda FTS5 y tags
- **Calendario / Tareas** — Vista mensual con panel lateral de tareas por día
- **Finanzas** — Dashboard con gráfica Recharts, CRUD de transacciones y exportación CSV

## Stack técnico
| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript 5 + Tailwind CSS v3 |
| Estado | Zustand (slices) |
| Editor | TipTap 2 (StarterKit) |
| Gráficas | Recharts |
| Desktop shell | Tauri 2.x |
| Base de datos | SQLite + SQLCipher (rusqlite, bundled-sqlcipher) |
| Pool | r2d2 + r2d2_sqlite |
| Encriptación clave | Argon2id (m=19456 KiB, t=2, p=1) |

## Prerequisitos

| Herramienta | Versión mínima |
|-------------|---------------|
| Rust (stable) | 1.77+ |
| Node.js | 18+ |
| npm | 9+ |
| **Windows** | Visual Studio Build Tools + WebView2 |
| **macOS** | Xcode Command Line Tools |
| **Linux** | `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev` |

## Cómo ejecutar

```bash
# 1. Instalar dependencias frontend
npm install

# 2. Modo desarrollo (Tauri + Vite en paralelo)
npm run dev

# 3. Build de producción (genera instalador en src-tauri/target/release/bundle/)
npm run build:desktop
```

### Linux — dependencias del sistema
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev
```

### macOS
```bash
xcode-select --install
```

### Windows
Instala [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con el workload **Desktop development with C++** y asegúrate de tener [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

## Seguridad
- El salt de Argon2id se guarda en `lifeos.salt.json` junto a la DB (nunca dentro de ella).
- La contraseña **nunca** se almacena en disco. SQLCipher verifica la clave al abrir.
- La DB arranca bloqueada; los comandos de datos retornan `AppError::Locked` hasta que se llama `unlock_db`.

## Tests Rust
```bash
cd src-tauri
cargo test
```
