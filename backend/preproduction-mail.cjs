'use strict';
const {setTimeout:sleep}=require('node:timers/promises');
const {normalizeEmail}=require('./login-service.cjs');
const {readConfig}=require('./preproduction-server.cjs');
const {createDeliveryStore}=require('./db/delivery-store.cjs');
const {createDeliveryVault}=require('./delivery-vault.cjs');
const {createDeliveryWorker}=require('./delivery-worker.cjs');
const {createResendTransport}=require('./resend-transport.cjs');
function createPreprodDelivery({env,pool,fetchImpl}={}){
 if(env?.JSB_MAIL_MODE!=='resend-test')throw Error('Activation explicite de la messagerie de test requise');
 const config=readConfig(env);
 const list=(env.JSB_MAIL_ALLOWED_RECIPIENTS||'').split(',').map(v=>v.trim()).filter(Boolean);
 if(!list.length||list.length>20||list.some(v=>normalizeEmail(v)!==v||/[\r\n,<>]/.test(v)))throw Error('Liste de destinataires de test requise');
 const allowed=new Set(list);
 const sendMail=createResendTransport({apiKey:env.JSB_RESEND_API_KEY,from:env.JSB_MAIL_FROM,namespace:env.JSB_MAIL_NAMESPACE,fetchImpl});
 return createDeliveryWorker({store:createDeliveryStore(pool),vault:createDeliveryVault(config.deliveryKeys),allowRecipient:email=>allowed.has(email),sendMail});
}
async function main(){
 const config=readConfig(process.env),{Pool}=require('pg');
 const pool=new Pool({connectionString:config.databaseUrl,max:2,connectionTimeoutMillis:5000,statement_timeout:10000});
 const stop=new AbortController();
 process.once('SIGTERM',()=>stop.abort());process.once('SIGINT',()=>stop.abort());
 try{
  if((await pool.query('SELECT current_database() AS name')).rows[0]?.name!=='jsb_preprod')throw Error('Base dédiée requise');
  // No real worker starts without a separate explicit mail configuration.
  const worker=createPreprodDelivery({env:process.env,pool});
  await pool.query('SELECT lease_id,attempts FROM jsb_auth.delivery_outbox WHERE false');
  console.log('JSB : service de messagerie de test démarré.');
  while(!stop.signal.aborted){
   await worker.purgeExpired();
   const result=await worker.runOnce();
   if(stop.signal.aborted)break;
   await sleep(result==='sent'?250:2000,undefined,{signal:stop.signal}).catch(e=>{if(e.name!=='AbortError')throw e;});
  }
 }finally{await pool.end();}
}
if(require.main===module)main().catch(()=>{console.error('Service de messagerie arrêté : configuration ou stockage indisponible.');process.exitCode=1;});
module.exports=Object.freeze({createPreprodDelivery});
