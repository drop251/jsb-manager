'use strict';
const {authorize}=require('../../core/platform-permissions.cjs');
const fail=status=>({ok:false,status});
const versionPattern=/^[A-Za-z0-9_.-]{1,80}$/;
const disciplines=new Set(['taiso','judo']);
function createCatalogueHistory(pool){
 if(typeof pool?.query!=='function'||typeof pool?.connect!=='function')throw TypeError('Pool requis');
 async function list(actor,discipline,{offset=0}={}){
  if(!authorize(actor,'catalogue','import'))return fail(403);
  if(!disciplines.has(discipline)||!Number.isSafeInteger(offset)||offset<0||offset>100000)return fail(400);
  const r=await pool.query(`WITH active AS (
   SELECT version,generation::text AS generation FROM jsb_catalogue.current_release WHERE discipline=$1
  ), published AS (
   SELECT p.version,p.previous_version AS "previousVersion",p.published_at AS "publishedAt",
   p.exercise_count AS count,r.source_hash AS hash
   FROM jsb_catalogue.publications p JOIN jsb_catalogue.releases r USING(discipline,version)
   WHERE p.discipline=$1
  ), page AS (SELECT * FROM published ORDER BY "publishedAt" DESC,version DESC LIMIT 30 OFFSET $2)
  SELECT (SELECT version FROM active) AS "activeVersion",COALESCE((SELECT generation FROM active),'0') AS generation,
   (SELECT count(*)::integer FROM published) AS total,
   COALESCE((SELECT json_agg(row_to_json(page) ORDER BY "publishedAt" DESC,version DESC) FROM page),'[]'::json) AS versions,
   COALESCE((SELECT json_agg(row_to_json(events) ORDER BY events.generation DESC) FROM (
     SELECT previous_version AS "previousVersion",restored_version AS "restoredVersion",generation::text AS generation,
       restored_at AS "restoredAt",reason FROM jsb_catalogue.restorations WHERE discipline=$1 ORDER BY generation DESC LIMIT 10
   ) events),'[]'::json) AS restorations`,[discipline,offset]);
  return {ok:true,status:200,history:{discipline,offset,...r.rows[0]}};
 }
 async function restore(actor,sessionHash,{discipline,targetVersion,expectedVersion,expectedGeneration,confirmationVersion,confirmed,reason}={}){
  if(!authorize(actor,'catalogue','import')||!/^[a-f0-9]{32}$/.test(actor.id))return fail(403);
  if(typeof sessionHash!=='string'||!/^[a-f0-9]{64}$/.test(sessionHash))return fail(401);
  if(!disciplines.has(discipline)||typeof targetVersion!=='string'||!versionPattern.test(targetVersion)||
    typeof expectedVersion!=='string'||!versionPattern.test(expectedVersion)||targetVersion===expectedVersion||
    typeof expectedGeneration!=='string'||!/^[1-9][0-9]{0,18}$/.test(expectedGeneration)||
    confirmed!==true||confirmationVersion!==targetVersion||typeof reason!=='string'||!reason.trim()||reason.length>500||reason.includes('\u0000'))return fail(400);
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended('jsb-catalogue-publish-v1:'||$1,0))",[discipline]);
   const a=await client.query("SELECT credential_version FROM jsb_auth.accounts WHERE id=$1 AND role='admin' AND status='active' AND email_verified=true FOR UPDATE",[actor.id]);
   if(a.rowCount!==1){await client.query('ROLLBACK');return fail(403);}
   const session=await client.query("SELECT hash FROM jsb_auth.sessions WHERE hash=$1 AND account_id=$2 AND role_at_issue='admin' AND credential_version=$3 AND issued_at<=floor(extract(epoch FROM clock_timestamp())*1000)::bigint AND expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint FOR UPDATE",[sessionHash,actor.id,a.rows[0].credential_version]);
   if(session.rowCount!==1){await client.query('ROLLBACK');return fail(401);}
   const current=await client.query('SELECT version,generation::text AS generation FROM jsb_catalogue.current_release WHERE discipline=$1',[discipline]);
   if(current.rows[0]?.version!==expectedVersion||current.rows[0]?.generation!==expectedGeneration){await client.query('ROLLBACK');return fail(409);}
   // Only versions with a publication record and a complete matching row count.
   const target=await client.query(`SELECT p.exercise_count AS count,r.source_hash AS hash
    FROM jsb_catalogue.publications p JOIN jsb_catalogue.releases r USING(discipline,version)
    WHERE p.discipline=$1 AND p.version=$2 AND p.exercise_count=(
      SELECT count(*) FROM jsb_catalogue.exercises e WHERE e.discipline=p.discipline AND e.version=p.version
    ) AND NOT EXISTS(SELECT 1 FROM jsb_catalogue.exercises e WHERE e.discipline=p.discipline AND e.version=p.version AND e.pedagogical_details IS NULL)`,[discipline,targetVersion]);
   if(target.rowCount!==1||targetVersion.toLowerCase().startsWith('recette-')){await client.query('ROLLBACK');return fail(409);}
   const next=await client.query('UPDATE jsb_catalogue.current_release SET version=$2,generation=generation+1 WHERE discipline=$1 RETURNING generation::text AS generation',[discipline,targetVersion]);
   const generation=next.rows[0].generation;
   await client.query("INSERT INTO jsb_catalogue.restorations(discipline,previous_version,restored_version,generation,actor_id,restored_at,reason) VALUES ($1,$2,$3,$4,$5,floor(extract(epoch FROM clock_timestamp())*1000)::bigint,$6)",[discipline,expectedVersion,targetVersion,generation,actor.id,reason.trim()]);
   const alive=await client.query("SELECT 1 FROM jsb_auth.sessions WHERE hash=$1 AND expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint",[sessionHash]);
   if(alive.rowCount!==1){await client.query('ROLLBACK');return fail(401);}
   await client.query('COMMIT');
   return {ok:true,status:200,restoration:{discipline,previousVersion:expectedVersion,version:targetVersion,generation,...target.rows[0]}};
  }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}finally{client.release();}
 }
 return Object.freeze({list,restore});
}
module.exports=Object.freeze({createCatalogueHistory});
