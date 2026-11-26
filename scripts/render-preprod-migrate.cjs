'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
// Dedicated new preproduction database only. Both Render services can start
// concurrently. A transaction lock protects the entire versioned migration.
async function migrate(pool){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  if((await client.query('SELECT current_database() AS name')).rows[0]?.name!=='jsb_preprod')throw Error('Base dédiée requise');
  await client.query('SELECT pg_advisory_xact_lock(183201773,36)');
  await client.query('CREATE SCHEMA IF NOT EXISTS jsb_deploy');
  await client.query('REVOKE ALL ON SCHEMA jsb_deploy FROM PUBLIC');
  await client.query('CREATE TABLE IF NOT EXISTS jsb_deploy.migrations (name text PRIMARY KEY, sha256 text NOT NULL)');
  const directory=path.join(__dirname,'../backend/db/migrations');
  const files=(await fs.readdir(directory)).filter(x=>/^\d{3}_[a-z0-9_]+\.sql$/.test(x)).sort();
  if(!files.length)throw Error('Migrations absentes');
  const previous=(await client.query('SELECT name,sha256 FROM jsb_deploy.migrations ORDER BY name')).rows;
  if(previous.some((r,i)=>r.name!==files[i]))throw Error('Historique incompatible');
  for(const [i,name] of files.entries()){
   const sql=await fs.readFile(path.join(directory,name),'utf8'),sha=createHash('sha256').update(sql).digest('hex');
   if(i<previous.length){if(previous[i].sha256!==sha)throw Error('Migration modifiée');continue;}
   if(i===0&&(await client.query("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname IN ('jsb_auth','jsb_private','jsb_catalogue','jsb_legal')")).rows[0].n!==0)throw Error('Base préexistante sans registre');
   const controls=sql.match(/^\s*(BEGIN|COMMIT|ROLLBACK);\s*$/gm)||[];
   if(controls.length!==2||!/^\s*BEGIN;/.test(controls[0])||!/^\s*COMMIT;/.test(controls[1])||!/^COMMIT;\s*$/m.test(sql))throw Error('Migration non transactionnelle');
   const body=sql.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
   await client.query(body);
   await client.query('INSERT INTO jsb_deploy.migrations(name,sha256) VALUES ($1,$2)',[name,sha]);
  }
  await client.query('COMMIT');
 }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}finally{client.release();}
}
module.exports={migrate};
