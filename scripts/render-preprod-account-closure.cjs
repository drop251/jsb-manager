'use strict';
// Manual operator procedure, never invoked by an HTTP request.
// Use only after verifying the request, lawful retention and secure response.
const {closeTestAccount}=require('../backend/db/account-closure.cjs');
async function main(){
 const [accountId,requestId,rawRevision,...flags]=process.argv.slice(2);
 if(!/^\d+$/.test(rawRevision||'')||!(flags.length===0||flags.length===2&&flags[0]==='--apply'&&flags[1]==='--review-approved')||!process.env.DATABASE_URL)throw Error('Arguments invalides');
 const {Pool}=require('pg');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
 try{console.log(JSON.stringify(await closeTestAccount(pool,{accountId,requestId,revision:Number(rawRevision),apply:flags.length===2,approved:flags.length===2})));}finally{await pool.end();}
}
main().catch(()=>{console.error('Clôture refusée ou non confirmée.');process.exitCode=1;});
