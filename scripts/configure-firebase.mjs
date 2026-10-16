import { createInterface } from 'node:readline/promises';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const rl=createInterface({input:process.stdin,output:process.stdout});
const ask=async(label,fallback='')=>(await rl.question(label+(fallback?` [${fallback}]`:'')+': ')).trim()||fallback;
const atomic=(path,value)=>{writeFileSync(path+'.tmp',value);renameSync(path+'.tmp',path);};
try{
  console.log('Configuración web PÚBLICA de Firebase. No introducir contraseñas ni claves privadas.');
  const projectId=await ask('projectId');
  if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId))throw new Error('El projectId debe ser el identificador exacto de tu proyecto Firebase.');
  const apiKey=await ask('apiKey de la aplicación web');
  const authDomain=await ask('authDomain',projectId+'.firebaseapp.com');
  const storageBucket=await ask('storageBucket');
  const messagingSenderId=await ask('messagingSenderId');
  const appId=await ask('appId');
  const functionsRegion=await ask('Región de Cloud Functions','us-central1');
  if(!/^[\w-]{20,200}$/.test(apiKey)||!/^[a-z0-9.-]+$/.test(authDomain)||!/^[a-z0-9.-]+$/.test(storageBucket)||!/^\d+$/.test(messagingSenderId)||!/^1:\d+:web:[a-zA-Z0-9]+$/.test(appId)||!/^([a-z]+-)+[a-z]+\d$/.test(functionsRegion))
    throw new Error('La configuración no es válida. Copia los valores de la aplicación web registrada en Firebase.');
  const functionsPath=resolve(root,'functions/index.js');const source=readFileSync(functionsPath,'utf8');
  const updated=source.replace(/setGlobalOptions\(\{ region: '[a-z0-9-]+'/g,`setGlobalOptions({ region: '${functionsRegion}'`);
  if(updated===source&&!source.includes(`region: '${functionsRegion}'`))throw new Error('No se pudo identificar la región del backend.');
  const settings={firebase:{apiKey,authDomain,projectId,storageBucket,messagingSenderId,appId},functionsRegion,emulators:null};
  atomic(resolve(root,'dist/firebase-config.js'),'export const config = '+JSON.stringify(settings,null,2)+';\n');
  atomic(resolve(root,'.firebaserc'),JSON.stringify({projects:{default:projectId}},null,2)+'\n');
  atomic(functionsPath,updated);
  atomic(resolve(root,'functions/.env'), 'AULANEXO_WEB_API_KEY=' + apiKey + '\n');
  console.log('Configuración guardada. Falta autenticar tu cuenta de Firebase y desplegar reglas, funciones y Hosting.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}
