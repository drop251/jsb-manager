'use strict';
// Manual, auditable operation on the dedicated private preview database only.
// Defaults to counts; explicit --apply is required. No connection secrets in logs.
const {technicalRetention}=require('../backend/db/technical-retention.cjs');
async function main(){
 const args=process.argv.slice(2);
 if(!(args.length===0||args.length===1&&args[0]==='--apply'))throw Error('Arguments invalides');
 if(!process.env.DATABASE_URL)throw Error('Connexion dédiée requise');
 const {Pool}=require('pg');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
 try{const result=await technicalRetention(pool,{apply:args[0]==='--apply'});console.log(JSON.stringify(result));}finally{await pool.end();}
}
main().catch(()=>{console.error('Purge technique refusée ou non confirmée.');process.exitCode=1;});
