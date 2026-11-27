'use strict';
const {normalize,empty}=require('../../core/attendance-sync.js');
const {authorize}=require('../../core/platform-permissions.cjs');
const fail=status=>({ok:false,status});
const clock="floor(extract(epoch FROM clock_timestamp())*1000)::bigint";
function createAttendanceStore(pool){
 async function execute(actor,sessionHash,action,body){
  if(!authorize(actor,'privateAttendance',action==='read'?'read':'write',{ownerId:actor?.id}))return fail(403);
  if(!/^[a-f0-9]{32}$/.test(actor.id)||!['read','save'].includes(action)||!body||body.expectedAccount!==actor.id)return fail(409);
  if(typeof sessionHash!=='string'||!/^[a-f0-9]{64}$/.test(sessionHash))return fail(401);
  let snapshot;
  if(action==='save'){
   if(!Number.isSafeInteger(body.revision)||body.revision<0||body.revision>=2147483647)return fail(400);
   try{snapshot=normalize(body.snapshot);}catch{return fail(400);}
  }
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const a=await c.query("SELECT credential_version FROM jsb_auth.accounts WHERE id=$1 AND role='coach' AND status='active' AND email_verified=true FOR UPDATE",[actor.id]);
   if(a.rowCount!==1){await c.query('ROLLBACK');return fail(403);}
   const s=await c.query(`SELECT hash FROM jsb_auth.sessions WHERE hash=$1 AND account_id=$2 AND role_at_issue='coach' AND credential_version=$3 AND issued_at<=${clock} AND expires_at>${clock} FOR UPDATE`,[sessionHash,actor.id,a.rows[0].credential_version]);
   if(s.rowCount!==1){await c.query('ROLLBACK');return fail(401);}
   const row=(await c.query('SELECT revision,snapshot FROM jsb_private.attendance_registers WHERE owner_id=$1 FOR UPDATE',[actor.id])).rows[0];
   const current=row?{revision:row.revision,snapshot:normalize(row.snapshot)}:{revision:0,snapshot:empty()};
   let result={ok:true,status:200,register:current};
   if(action==='save'){
    // Identical content is an idempotent retry, including when a response was lost.
    if(JSON.stringify(snapshot)!==JSON.stringify(current.snapshot)){
     if(body.revision!==current.revision)result={ok:false,status:409,register:current};
     else{
      const revision=current.revision+1;
      await c.query(`INSERT INTO jsb_private.attendance_registers(owner_id,revision,snapshot,updated_at) VALUES($1,$2,$3,${clock}) ON CONFLICT(owner_id) DO UPDATE SET revision=EXCLUDED.revision,snapshot=EXCLUDED.snapshot,updated_at=EXCLUDED.updated_at`,[actor.id,revision,JSON.stringify(snapshot)]);
      result={ok:true,status:200,register:{revision,snapshot}};
     }
    }
   }
   const alive=await c.query(`SELECT 1 FROM jsb_auth.sessions WHERE hash=$1 AND expires_at>${clock}`,[sessionHash]);
   if(alive.rowCount!==1){await c.query('ROLLBACK');return fail(401);}
   await c.query('COMMIT');return result;
  }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
 }
 return Object.freeze({execute});
}
module.exports=Object.freeze({createAttendanceStore});
