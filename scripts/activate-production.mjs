import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv.includes('--backend-ready')) {
  console.error('Primero habilita Authentication, Firestore y Storage, despliega el backend y crea el propietario. Después: npm run activate:production -- --backend-ready');
  process.exit(1);
}
const { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId } = JSON.parse(readFileSync(resolve(root, 'dist/firebase-config.production.json'), 'utf8'));
if (!apiKey || !projectId || !appId) throw new Error('Configuración web incompleta.');
writeFileSync(resolve(root, 'dist/firebase-config.js'), 'export const config = ' + JSON.stringify({ firebase: { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }, functionsRegion:'us-central1', emulators:null }, null, 2) + ';\n');
writeFileSync(resolve(root, 'functions/.env'), `FIREBASE_WEB_API_KEY=${apiKey}\n`);
console.log('Conexión real activada localmente. Verifica con npm run check antes de publicar.');
