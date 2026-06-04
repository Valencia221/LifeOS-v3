import { cp, mkdir } from 'fs/promises';
import { join } from 'path';
const src = join('src-tauri', 'target', 'release', 'bundle');
const dest = join('dist-app');
await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log('✓ dist-app/ creada con los ejecutables.');
