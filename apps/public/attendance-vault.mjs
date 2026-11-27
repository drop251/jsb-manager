// The attendance vault is independent of the Taïso vault. No credentials in storage.
import '../shared/attendance-sync.js';
const {normalize}=window.JSBAttendance;
const KEY='jsb-attendance-vault-v1',LOCK=KEY+'-lock',SCHEMA='JSB-ATTENDANCE-VAULT-1',ITERATIONS=600000;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function support(){if(!crypto?.subtle||!navigator.locks)throw Error('Coffre indisponible sur cet appareil.');}
function clean(v){
 if(!v||typeof v.owner!=='string'||!/^[a-f0-9]{32}$/.test(v.owner)||!Number.isSafeInteger(v.revision)||v.revision<0||v.revision>=2147483647)throw Error('Coffre invalide.');
 return {owner:v.owner,revision:v.revision,base:normalize(v.base),working:normalize(v.working)};
}
async function derive(phrase,salt){
 if(typeof phrase!=='string'||phrase.length<12||phrase.length>256)throw Error('Phrase secrète de 12 caractères minimum.');
 const material=await crypto.subtle.importKey('raw',enc.encode(phrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
const raw=()=>localStorage.getItem(KEY);
export const hasAttendanceVault=()=>{try{return raw()!==null;}catch{return false;}};
async function seal(key,salt,value){
 const iv=crypto.getRandomValues(new Uint8Array(12)),plain=enc.encode(JSON.stringify(clean(value)));
 if(plain.length>510000)throw Error('Coffre trop volumineux.');
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(SCHEMA)},key,plain);
 return JSON.stringify({schema:SCHEMA,salt:b64(salt),iv:b64(iv),cipher:b64(new Uint8Array(cipher))});
}
async function write(expected,next,allowed=()=>true){
 return navigator.locks.request(LOCK,()=>{
  if(!allowed()||raw()!==expected)throw Error('Coffre modifié ou verrouillé dans une autre fenêtre.');
  if(next===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,next);
  if(raw()!==next)throw Error('Enregistrement local non confirmé.');
 });
}
export async function createAttendanceVault(phrase,value,allowed=()=>true){
 support();if(raw()!==null)throw Error('Un coffre existe déjà.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),key=await derive(phrase,salt);
 const initial=await seal(key,salt,value);await write(null,initial,allowed);
}
export async function openAttendanceVault(phrase){
 support();let expected=raw();if(expected===null||expected.length>700000)throw Error('Coffre indisponible.');
 const envelope=JSON.parse(expected);
 if(envelope.schema!==SCHEMA||typeof envelope.salt!=='string'||typeof envelope.iv!=='string'||typeof envelope.cipher!=='string')throw Error('Coffre invalide.');
 const salt=unb64(envelope.salt),iv=unb64(envelope.iv),cipher=unb64(envelope.cipher);
 if(salt.length!==16||iv.length!==12||cipher.length<16||cipher.length>510016)throw Error('Coffre invalide.');
 const key=await derive(phrase,salt),value=clean(JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(SCHEMA)},key,cipher))));
 if(raw()!==expected)throw Error('Coffre modifié.');
 let closed=false;
 return {
  value,
  async save(next,allowed=()=>true){
   if(closed||next.owner!==value.owner)throw Error('Coffre verrouillé.');
   next=clean(next);const encrypted=await seal(key,salt,next);
   await write(expected,encrypted,()=>!closed&&allowed());
   expected=encrypted;Object.assign(value,next);
  },
  async remove(){await write(expected,null,()=>!closed);closed=true;},
  close(){closed=true;}
 };
}
export const attendanceVaultKey=KEY;
