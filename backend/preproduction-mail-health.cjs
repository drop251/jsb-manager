'use strict';
const {readConfig}=require('./preproduction-server.cjs');
// Read-only operational counters, no addresses, message content or codes.
async function readDeliveryHealth(pool){
 if(typeof pool?.query!=='function')throw TypeError('Pool requis');
 if((await pool.query('SELECT current_database() AS name')).rows[0]?.name!=='jsb_preprod')throw Error('Base de préproduction requise');
 const r=await pool.query(`WITH clock AS (SELECT floor(extract(epoch FROM statement_timestamp())*1000)::bigint AS ms)
 SELECT count(*) FILTER (WHERE expires_at>ms AND attempts<10 AND (lease_until IS NULL OR lease_until<=ms) AND next_attempt_at<=ms)::text AS ready,
 count(*) FILTER (WHERE expires_at>ms AND lease_until>ms)::text AS processing,
 count(*) FILTER (WHERE expires_at>ms AND attempts<10 AND (lease_until IS NULL OR lease_until<=ms) AND next_attempt_at>ms)::text AS delayed,
 count(*) FILTER (WHERE expires_at<=ms OR (attempts>=10 AND (lease_until IS NULL OR lease_until<=ms)))::text AS discardable
 FROM jsb_auth.delivery_outbox CROSS JOIN clock`);
 const row=r.rows[0],report={};
 for(const key of ['ready','processing','delayed','discardable']){
  if(typeof row?.[key]!=='string'||!/^\d+$/.test(row[key]))throw Error('Compteurs indisponibles');
  const n=Number(row[key]);if(!Number.isSafeInteger(n))throw Error('Compteur hors limite');
  report[key]=n;
 }
 return Object.freeze(report);
}
async function main(){
 const config=readConfig(process.env),{Pool}=require('pg');
 const pool=new Pool({connectionString:config.databaseUrl,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});
 try{console.log(JSON.stringify(await readDeliveryHealth(pool)));}
 finally{await pool.end();}
}
if(require.main===module)main().catch(()=>{console.error('Diagnostic de messagerie indisponible.');process.exitCode=1;});
module.exports=Object.freeze({readDeliveryHealth});
