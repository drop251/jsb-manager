'use strict';
const {randomBytes,timingSafeEqual}=require('node:crypto');
const {normalizeEmail}=require('./login-service.cjs');
const {hashPassword}=require('./passwords.cjs');
const {generateSecret,provisioningUri,codeForStep}=require('./admin-mfa.cjs');
const {createMfaVault}=require('./mfa-vault.cjs');
// Offline operator-only bootstrap. Never exposed as an HTTP endpoint.
// Only a dedicated preproduction database and its first administrator.
async function bootstrapFirstAdmin({pool,mfaKeys,email,confirmTotp,now=Date.now}={}){
 email=normalizeEmail(email);
 if(!email||typeof confirmTotp!=='function'||typeof now!=='function'||typeof pool?.connect!=='function')throw TypeError('Configuration initiale invalide');
 if((await pool.query('SELECT current_database() AS name')).rows[0]?.name!=='jsb_preprod')throw Error('Base dédiée requise');
 if((await pool.query("SELECT 1 FROM jsb_auth.accounts WHERE role='admin' LIMIT 1")).rowCount)throw Error('Administrateur déjà initialisé');
 const id=randomBytes(16).toString('hex'),factorVersion=randomBytes(16).toString('hex'),secret=generateSecret();
 const password=randomBytes(24).toString('base64url');
 const vault=createMfaVault(mfaKeys);
 try{
  const envelope=await vault.seal({accountId:id,factorVersion,secret});
  const code=await confirmTotp({uri:provisioningUri(secret,email)});
  if(typeof code!=='string'||!/^\d{6}$/.test(code))throw Error('Confirmation MFA refusée');
  const time=now();if(!Number.isSafeInteger(time)||time<0)throw Error('Horloge invalide');
  const current=Math.floor(time/30000);let matched=-1;
  for(const step of [current-1,current,current+1])if(step>=0&&timingSafeEqual(Buffer.from(code),Buffer.from(codeForStep(secret,step))))matched=Math.max(matched,step);
  if(matched<0)throw Error('Confirmation MFA refusée');
  const passwordHash=await hashPassword(password);
  const c=await pool.connect();let discard=false;
  try{
   await c.query('BEGIN');
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended('jsb-preprod-first-admin-v1',0))");
   if((await c.query("SELECT 1 FROM jsb_auth.accounts WHERE role='admin' LIMIT 1")).rowCount)throw Error('Administrateur déjà initialisé');
   // A locally verified operator attests control of this test email address.
   const clock=await c.query("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS ms");
   const ms=Number(clock.rows[0].ms);
   if(!Number.isSafeInteger(ms)||Math.abs(Math.floor(ms/30000)-matched)>1)throw Error('Confirmation MFA expirée');
   await c.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,$3,'admin','active',true,$4)",[id,email,passwordHash,ms]);
   await c.query('INSERT INTO jsb_auth.mfa_factors(account_id,factor_version,encrypted_secret,enabled,last_step) VALUES ($1,$2,$3,true,$4)',[id,factorVersion,envelope,matched]);
   await c.query('COMMIT');
   return Object.freeze({email,password});
  }catch(e){try{await c.query('ROLLBACK');}catch{discard=true;}throw e;}finally{c.release(discard);}
 }finally{secret.fill(0);}
}
async function main(){
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Terminal interactif privé requis');
 const {readConfig}=require('./preproduction-server.cjs'),{Pool}=require('pg'),{createInterface}=require('node:readline/promises');
 const config=readConfig(process.env);
 const pool=new Pool({connectionString:config.databaseUrl,max:2,connectionTimeoutMillis:5000,statement_timeout:10000});
 const rl=createInterface({input:process.stdin,output:process.stdout});
 try{
  console.log('Initialisation du premier administrateur de TEST. Terminal privé, sans enregistrement.');
  const email=await rl.question('Adresse de test contrôlée par vous : ');
  if(await rl.question('Confirmer le contrôle de cette adresse et la base jsb_preprod (OUI) : ')!=='OUI')throw Error('Confirmation refusée');
  const result=await bootstrapFirstAdmin({pool,mfaKeys:config.mfaKeys,email,confirmTotp:async({uri})=>{
   console.log('Configurez votre application TOTP avec cette URI privée (ne pas partager) :\n'+uri);
   return (await rl.question('Code TOTP à 6 chiffres : ')).trim();
  }});
  console.log('Compte de test créé : '+result.email+'\nMot de passe généré (à conserver dans un gestionnaire de mots de passe) : '+result.password+'\nAttendez un nouveau code TOTP avant la connexion. Fermez ce terminal privé.');
 }finally{rl.close();await pool.end();}
}
if(require.main===module)main().catch(()=>{console.error('Initialisation refusée. Vérifiez la configuration, la base et le code MFA. Aucun secret ne sera journalisé par cette erreur.');process.exitCode=1;});
module.exports=Object.freeze({bootstrapFirstAdmin});
