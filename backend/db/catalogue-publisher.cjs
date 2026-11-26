'use strict';
const {authorize}=require('../../core/platform-permissions.cjs');
const {analyzeCatalogueImport}=require('../../core/catalogue-import.cjs');
const fail=status=>({ok:false,status});
const versionPattern=/^[A-Za-z0-9_.-]{1,80}$/;
function createCataloguePublisher(pool){
 if(typeof pool?.connect!=='function')throw TypeError('Pool requis');
 // Trusted internal call only; sessionHash is derived server-side from the
 // authenticated session cookie. There is no HTTP publication route yet.
 async function publish(actor,sessionHash,{discipline,text,expectedHash,expectedPreviousVersion,confirmed}={}){
  if(!authorize(actor,'catalogue','import')||!/^[a-f0-9]{32}$/.test(actor.id))return fail(403);
  if(typeof sessionHash!=='string'||!/^[a-f0-9]{64}$/.test(sessionHash))return fail(401);
  if(confirmed!==true||typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash)||
    !(expectedPreviousVersion===null||(typeof expectedPreviousVersion==='string'&&versionPattern.test(expectedPreviousVersion))))return fail(400);
  const analyzed=analyzeCatalogueImport(text,discipline);
  if(!analyzed.ok)return fail(400);
  if(analyzed.report.hash!==expectedHash)return fail(409);
  const {version,exercises}=analyzed.canonical;
  // Recipe identifiers are never permanent reference-catalogue identifiers.
  if(version.toLowerCase().startsWith('recette-')||exercises.some(e=>e.reference.toLowerCase().startsWith('recette-')))return fail(400);
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   // Serialize same-discipline publications, including first publication.
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended('jsb-catalogue-publish-v1:'||$1,0))",[discipline]);
   // Recheck both account and session under row locks. No caller-provided role
   // or stale session can authorize a write.
   const a=await client.query("SELECT credential_version FROM jsb_auth.accounts WHERE id=$1 AND role='admin' AND status='active' AND email_verified=true FOR UPDATE",[actor.id]);
   if(a.rowCount!==1){await client.query('ROLLBACK');return fail(403);}
   const s=await client.query("SELECT hash FROM jsb_auth.sessions WHERE hash=$1 AND account_id=$2 AND role_at_issue='admin' AND credential_version=$3 AND issued_at<=floor(extract(epoch FROM clock_timestamp())*1000)::bigint AND expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint FOR UPDATE",[sessionHash,actor.id,a.rows[0].credential_version]);
   if(s.rowCount!==1){await client.query('ROLLBACK');return fail(401);}
   const current=await client.query('SELECT version FROM jsb_catalogue.current_release WHERE discipline=$1',[discipline]);
   const previous=current.rows[0]?.version??null;
   if(previous!==expectedPreviousVersion){await client.query('ROLLBACK');return fail(409);}
   const release=await client.query("INSERT INTO jsb_catalogue.releases(discipline,version,source_hash,published_at) VALUES ($1,$2,$3,floor(extract(epoch FROM clock_timestamp())*1000)::bigint) ON CONFLICT DO NOTHING RETURNING published_at",[discipline,version,expectedHash]);
   if(release.rowCount!==1){await client.query('ROLLBACK');return fail(409);}
   // One bounded parameterized insert, no interpolation of file contents.
   await client.query(`INSERT INTO jsb_catalogue.exercises(discipline,version,reference,name,family,pedagogical_details)
   SELECT $1,$2,x.reference,x.name,x.family,x.details
   FROM jsonb_to_recordset($3::jsonb) AS x(reference text,name text,family text,details jsonb)`,[discipline,version,JSON.stringify(exercises)]);
   await client.query('INSERT INTO jsb_catalogue.current_release(discipline,version) VALUES ($1,$2) ON CONFLICT (discipline) DO UPDATE SET version=EXCLUDED.version',[discipline,version]);
   await client.query('INSERT INTO jsb_catalogue.publications(discipline,version,previous_version,actor_id,published_at,exercise_count) VALUES ($1,$2,$3,$4,$5,$6)',[discipline,version,previous,actor.id,release.rows[0].published_at,exercises.length]);
   const alive=await client.query("SELECT 1 FROM jsb_auth.sessions WHERE hash=$1 AND expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint",[sessionHash]);
   if(alive.rowCount!==1){await client.query('ROLLBACK');return fail(401);}
   await client.query('COMMIT');
   return {ok:true,status:200,publication:{discipline,version,previousVersion:previous,hash:expectedHash,count:exercises.length}};
  }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}finally{client.release();}
 }
 return Object.freeze({publish});
}
module.exports=Object.freeze({createCataloguePublisher});
