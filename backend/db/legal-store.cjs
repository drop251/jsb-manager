'use strict';
const {createHash,randomBytes}=require('node:crypto');
const {authorize}=require('../../core/platform-permissions.cjs');
const fail=status=>({ok:false,status});
const digest=s=>createHash('sha256').update(s,'utf8').digest('hex');
const clock="floor(extract(epoch FROM clock_timestamp())*1000)::bigint";
const types=['cgu','privacy','cgv'];
const id=/^[a-f0-9]{32}$/;
function createLegalStore(pool,{approvedHashes={}}={}){
 if(!approvedHashes||typeof approvedHashes!=='object'||Array.isArray(approvedHashes)||Object.entries(approvedHashes).some(([type,hash])=>!['cgu','privacy'].includes(type)||typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)))throw TypeError('Configuration d’approbation juridique invalide');
 const approved=Object.freeze({...approvedHashes});
 async function documents(actor=null){
  // Read only effective, immutable publications. Drafts are never returned
  // to the public endpoint, even if a future publication is scheduled.
  const result=await pool.query(`SELECT DISTINCT ON(p.type) p.type,p.version,p.hash,p.effective_at AS "effectiveAt",d.body,
    a.kind,a.recorded_at AS "recordedAt"
   FROM jsb_legal.published p JOIN jsb_legal.drafts d ON d.id=p.draft_id
   LEFT JOIN jsb_legal.acceptances a ON a.account_id=$1 AND a.type=p.type AND a.version=p.version
   WHERE p.type IN ('cgu','privacy') AND p.effective_at<=${clock}
   ORDER BY p.type,p.effective_at DESC`,[actor?.id??null]);
  return {ok:true,status:200,documents:result.rows.map(r=>({...r,effectiveAt:Number(r.effectiveAt),recordedAt:r.recordedAt===null?null:Number(r.recordedAt)}))};
 }
 async function execute(actor,sessionHash,action,body){
  const admin=['draft','history','publish'].includes(action);
  const scope={ownerId:actor?.id};
  if(admin?(actor?.role!=='admin'||!authorize(actor,'legal',action==='draft'?'draft':action==='publish'?'publish':'read')):!authorize(actor,'legalAcceptance','write',scope))return fail(403);
  if(!['draft','history','publish','record'].includes(action)||!body||body.expectedAccount!==actor.id||!id.test(actor.id))return fail(409);
  if(typeof sessionHash!=='string'||!/^[a-f0-9]{64}$/.test(sessionHash))return fail(401);
  const {type}=body;
  if(!types.includes(type)||type==='cgv'&&action==='record')return fail(400);
  if(action==='publish'){
   if(!['cgu','privacy'].includes(type)||!Object.hasOwn(approved,type))return fail(403);
   if(typeof body.hash!=='string'||body.hash!==approved[type]||typeof body.draftId!=='string'||!id.test(body.draftId)||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=2147483647||body.confirmed!==true)return fail(409);
  }
  if(action==='draft'&&(typeof body.body!=='string'||!body.body.trim()||Buffer.byteLength(body.body,'utf8')>262144||body.body.includes('\u0000')))return fail(400);
  if(action==='record'&&(!Number.isSafeInteger(body.version)||body.version<1||body.version>2147483647||typeof body.hash!=='string'||!/^[a-f0-9]{64}$/.test(body.hash)||body.confirmed!==true||body.kind!==(type==='cgu'?'acceptance':'acknowledgement')))return fail(400);
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   // Consistent lock order for any future publication operation.
   await c.query('SELECT type FROM jsb_legal.document_types WHERE type=$1 FOR UPDATE',[type]);
   const a=await c.query("SELECT credential_version FROM jsb_auth.accounts WHERE id=$1 AND role=$2 AND status='active' AND email_verified=true FOR UPDATE",[actor.id,actor.role]);
   if(a.rowCount!==1){await c.query('ROLLBACK');return fail(403);}
   const s=await c.query(`SELECT hash FROM jsb_auth.sessions WHERE hash=$1 AND account_id=$2 AND role_at_issue=$3 AND credential_version=$4 AND issued_at<=${clock} AND expires_at>${clock} FOR UPDATE`,[sessionHash,actor.id,actor.role,a.rows[0].credential_version]);
   if(s.rowCount!==1){await c.query('ROLLBACK');return fail(401);}
   let response;
   if(action==='draft'){
    const hash=digest(body.body),draftId=randomBytes(16).toString('hex');
    const r=await c.query(`INSERT INTO jsb_legal.drafts(id,type,body,hash,created_at,created_by) VALUES($1,$2,$3,$4,${clock},$5) RETURNING id,type,hash,created_at AS "createdAt"`,[draftId,type,body.body,hash,actor.id]);
    response={draft:{...r.rows[0],createdAt:Number(r.rows[0].createdAt)}};
   }else if(action==='history'){
    const r=await c.query('SELECT id,type,body,hash,created_at AS "createdAt" FROM jsb_legal.drafts WHERE type=$1 ORDER BY created_at DESC,id LIMIT 10',[type]);
    const latest=(await c.query('SELECT version FROM jsb_legal.published WHERE type=$1 ORDER BY version DESC LIMIT 1',[type])).rows[0];
    response={drafts:r.rows.map(d=>({...d,createdAt:Number(d.createdAt)})),publicationEnabled:Object.hasOwn(approved,type),approvedHash:approved[type]??null,latestVersion:latest?.version??0};
   }else if(action==='publish'){
    // Approval is server configuration for this exact digest, never a flag
    // provided by the browser. Render preproduction supplies no approvals.
    const d=(await c.query('SELECT id,hash,body FROM jsb_legal.drafts WHERE id=$1 AND type=$2 AND hash=$3',[body.draftId,type,body.hash])).rows[0];
    if(!d||digest(d.body)!==body.hash){await c.query('ROLLBACK');return fail(409);}
    const existing=(await c.query('SELECT version,hash,effective_at AS "effectiveAt" FROM jsb_legal.published WHERE draft_id=$1 AND type=$2',[d.id,type])).rows[0];
    if(existing)response={publication:{type,...existing,effectiveAt:Number(existing.effectiveAt)}};
    else{
     const latest=(await c.query('SELECT version,effective_at FROM jsb_legal.published WHERE type=$1 ORDER BY version DESC LIMIT 1',[type])).rows[0];
     const now=Number((await c.query('SELECT '+clock+' AS now')).rows[0].now);
     if((latest?.version??0)!==body.expectedVersion||latest&&Number(latest.effective_at)>=now){await c.query('ROLLBACK');return fail(409);}
     const p=(await c.query('INSERT INTO jsb_legal.published(type,version,draft_id,hash,published_at,effective_at,published_by) VALUES($1,$2,$3,$4,$5,$5,$6) RETURNING type,version,hash,effective_at AS "effectiveAt"',[type,body.expectedVersion+1,d.id,d.hash,now,actor.id])).rows[0];
     response={publication:{...p,effectiveAt:Number(p.effectiveAt)}};
    }
   }else{
    const p=(await c.query(`SELECT version,hash FROM jsb_legal.published WHERE type=$1 AND effective_at<=${clock} ORDER BY effective_at DESC LIMIT 1`,[type])).rows[0];
    if(!p||p.version!==body.version||p.hash!==body.hash){await c.query('ROLLBACK');return fail(409);}
    await c.query(`INSERT INTO jsb_legal.acceptances(account_id,type,version,hash,kind,recorded_at) VALUES($1,$2,$3,$4,$5,${clock}) ON CONFLICT(account_id,type,version) DO NOTHING`,[actor.id,type,p.version,p.hash,body.kind]);
    const r=(await c.query('SELECT type,version,hash,kind,recorded_at AS "recordedAt" FROM jsb_legal.acceptances WHERE account_id=$1 AND type=$2 AND version=$3',[actor.id,type,p.version])).rows[0];
    response={record:{...r,recordedAt:Number(r.recordedAt)}};
   }
   const alive=await c.query(`SELECT 1 FROM jsb_auth.sessions WHERE hash=$1 AND expires_at>${clock}`,[sessionHash]);
   if(alive.rowCount!==1){await c.query('ROLLBACK');return fail(401);}
   await c.query('COMMIT');return {ok:true,status:200,...response};
  }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
 }
 return Object.freeze({documents,execute});
}
module.exports=Object.freeze({createLegalStore,digest});
