import readline from 'node:readline';
import { Writable } from 'node:stream';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json',import.meta.url));
const { initializeApp, applicationDefault } = await import(require.resolve('firebase-admin/app'));
const { getAuth } = await import(require.resolve('firebase-admin/auth'));
const { getFirestore } = await import(require.resolve('firebase-admin/firestore'));
const { validateUserInput } = await import('../dist/core.js');
let mute=false;
const output=new Writable({write(chunk,encoding,callback){if(!mute)process.stdout.write(chunk);callback();}});
const rl=readline.createInterface({input:process.stdin,output,terminal:process.stdin.isTTY});
const question=prompt=>new Promise(resolve=>rl.question(prompt,resolve));
try{
  console.log('Crear el primer propietario de AulaNexo. Requiere credenciales ADC de Google en tu equipo.');
  const projectId=(await question('ID de tu proyecto Firebase: ')).trim();
  if(!/^[a-z][a-z0-9-]{4,40}$/.test(projectId))throw new Error('ID de proyecto no válido.');
  initializeApp({projectId,credential:applicationDefault()});
  const db=getFirestore();const auth=getAuth();
  const existing=await db.collection('users').where('role','==','owner').limit(1).get();
  if(!existing.empty)throw new Error('Ya existe un propietario. Crea los demás usuarios desde su panel.');
  const displayName=(await question('Nombre del propietario: ')).trim();
  const email=(await question('Correo del propietario: ')).trim().toLowerCase();
  process.stdout.write('Contraseña inicial (oculta): ');mute=true;
  const password=await question('');mute=false;process.stdout.write('\n');
  validateUserInput({displayName,email,password,role:'teacher',level:'independent'});
  const user=await auth.createUser({displayName,email,password,disabled:true});
  try{
    await db.doc(`users/${user.uid}`).set({displayName,email,role:'owner',level:'independent',stage:'',active:true,courseIds:[],managerIds:[],displayNameFold:displayName.toLocaleLowerCase('es'),createdAt:new Date().toISOString(),createdBy:user.uid});
    await auth.setCustomUserClaims(user.uid,{role:'owner'});await auth.updateUser(user.uid,{disabled:false});
    console.log('Propietario creado. Ya puedes ingresar al aula con tu correo y contraseña.');
  }catch(error){await db.doc(`users/${user.uid}`).set({active:false},{merge:true}).catch(()=>{});await auth.deleteUser(user.uid).catch(()=>{});throw error;}
}catch(error){console.error(error.message);process.exitCode=1;}finally{mute=false;rl.close();}
