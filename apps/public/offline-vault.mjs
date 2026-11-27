// One explicitly opted-in offline copy per browser origin. Only ciphertext is stored.
// This is not a session or authorization token. Online writes always revalidate ownership.
const KEY='jsb-offline-vault-v1',LOCK='jsb-offline-vault-lock-v1',SCHEMA='JSB-OFFLINE-VAULT-1',ITERATIONS=600000;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function support(){if(!globalThis.crypto?.subtle||!navigator.locks)throw Error('Coffre indisponible sur cet appareil.');}
function passwordOK(password){return typeof password==='string'&&password.length>=12&&password.length<=256;}
function readRaw(){return localStorage.getItem(KEY);}
export function hasVault(){try{return readRaw()!==null;}catch{return false;}}
async function derive(password,salt){
 if(!passwordOK(password))throw Error('Phrase secrète de 12 caractères minimum.');
 const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function valid(value){
 return value&&typeof value.owner==='string'&&value.owner.length>0&&value.owner.length<=128&&value.copy?.schema==='JSB-TAISO-OFFLINE-1'&&Array.isArray(value.edits)&&Number.isSafeInteger(value.copy.baseEditCount)&&value.copy.baseEditCount>=0&&value.edits.length+value.copy.baseEditCount<=60&&value.edits.every(e=>e&&Object.keys(e).length===3&&['up','down','remove'].includes(e.action)&&typeof e.phase==='string'&&e.phase.length<=100&&typeof e.reference==='string'&&e.reference.length<=80);
}
async function seal(key,salt,value){
 if(!valid(value))throw Error('Copie non conforme.');
 const plain=enc.encode(JSON.stringify(value));
 if(plain.length>590000)throw Error('Copie trop volumineuse.');
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(SCHEMA)},key,plain);
 return JSON.stringify({schema:SCHEMA,salt:b64(salt),iv:b64(iv),cipher:b64(new Uint8Array(cipher))});
}
async function write(expected,next){
 return navigator.locks.request(LOCK,()=>{
  if(readRaw()!==expected)throw Error('Le coffre a changé dans une autre fenêtre.');
  if(next===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,next);
  if(readRaw()!==next)throw Error('Enregistrement local non confirmé.');
 });
}
export async function createVault(password,owner,copy,stillAllowed=()=>true){
 support();if(readRaw()!==null)throw Error('Un coffre existe déjà. Reprenez-le ou effacez-le explicitement.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),key=await derive(password,salt);
 const raw=await seal(key,salt,{owner,copy,edits:[]});
 if(!stillAllowed())throw Error('Session non confirmée.');
 // Caller checks the current account immediately before storage; no login credentials are stored.
 await navigator.locks.request(LOCK,()=>{
  if(!stillAllowed()||readRaw()!==null)throw Error('Coffre ou session modifié.');
  localStorage.setItem(KEY,raw);
  if(readRaw()!==raw)throw Error('Enregistrement local non confirmé.');
 });
}
export async function openVault(password){
 support();let raw=readRaw();if(raw===null||raw.length>800000)throw Error('Coffre indisponible.');
 const envelope=JSON.parse(raw);
 if(envelope.schema!==SCHEMA||typeof envelope.salt!=='string'||typeof envelope.iv!=='string'||typeof envelope.cipher!=='string')throw Error('Coffre invalide.');
 const salt=unb64(envelope.salt),iv=unb64(envelope.iv),cipher=unb64(envelope.cipher);
 if(salt.length!==16||iv.length!==12||cipher.length<16||cipher.length>590016)throw Error('Coffre invalide.');
 const key=await derive(password,salt);
 const value=JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(SCHEMA)},key,cipher)));
 if(!valid(value)||readRaw()!==raw)throw Error('Coffre invalide ou modifié.');
 let closed=false;
 return {
  value,
  async save(edits){
   if(closed)throw Error('Coffre verrouillé.');
   const next=await seal(key,salt,{owner:value.owner,copy:value.copy,edits});
   if(closed)throw Error('Coffre verrouillé.');
   await write(raw,next);raw=next;value.edits=structuredClone(edits);
  },
  async remove(){if(closed)throw Error('Coffre verrouillé.');await write(raw,null);closed=true;},
  close(){closed=true;}
 };
}
export function vaultPatch(value){
 const v=value.copy;
 return {schema:'JSB-TAISO-EDITS-1',draftId:v.draftId,revision:v.revision,version:v.version,generation:v.generation,baseEditCount:v.baseEditCount,edits:value.edits};
}
