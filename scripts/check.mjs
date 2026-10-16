import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const walk = root => readdirSync(root).filter(name=>!['node_modules','.git'].includes(name)).flatMap(name=>{const path=`${root}/${name}`;return statSync(path).isDirectory()?walk(path):[path];});
for(const file of [...walk('dist'),...walk('functions'),...walk('scripts')].filter(f=>/\.(mjs|js)$/.test(f))){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr);process.exit(result.status||1);}
}
for(const file of ['firebase.json','firestore.indexes.json','package.json','functions/package.json',...(existsSync('.openai/hosting.json')?['.openai/hosting.json']:[])])JSON.parse(readFileSync(file,'utf8'));
assert.equal(readFileSync('dist/core.js','utf8'),readFileSync('functions/core.js','utf8'),'La validación del cliente y servidor debe estar sincronizada.');
const { config } = await import('../dist/firebase-config.js');
if(config.firebase){
  assert.ok(config.firebase.projectId && config.firebase.apiKey && config.firebase.appId,'La configuración de Firebase debe estar completa.');
  assert.ok(!('private_key' in config.firebase),'No colocar claves privadas en el frontend.');
}
assert.ok(!readFileSync('functions/index.js','utf8').includes('getDownloadURL'),'Los archivos privados no deben emitir enlaces permanentes de descarga.');
assert.ok(readFileSync('firestore.rules','utf8').includes('match /examKeys/{id} { allow read, write: if false; }'));
assert.ok(readFileSync('firestore.rules','utf8').includes('allow write: if false;'));
const html=readFileSync('dist/index.html','utf8');assert.ok(html.includes('lang="es"'));assert.ok(html.includes('viewport'));assert.ok(html.includes('type="module" src="app.js"'));
console.log('Sintaxis, configuración y estructura verificadas.');
