/* Shared attendance contract and deterministic three-way merge. No storage or network. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.JSBAttendance=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const idPattern=/^[a-f0-9]{32}$/,isId=v=>typeof v==='string'&&idPattern.test(v);
 const name=v=>typeof v==='string'&&v.trim()===v&&v.length>=1&&v.length<=100&&!/[\x00-\x1f\x7f]/.test(v);
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='2000-01-01'&&v<='2100-12-31'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
 const empty=()=>({groups:[],members:[],slots:[],calls:[]});
 const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
 const callKey=c=>c.date+':'+c.slotId;
 const order=(a,b)=>a<b?-1:a>b?1:0;
 function normalize(s){
  if(!exact(s,['groups','members','slots','calls']))throw Error('Registre invalide.');
  for(const [key,max] of [['groups',50],['members',500],['slots',100],['calls',1000]])if(!Array.isArray(s[key])||s[key].length>max)throw Error('Limite du registre dépassée.');
  const groups=new Set(),members=new Set(),slots=new Set(),calls=new Set();
  for(const g of s.groups){if(!exact(g,['id','name'])||!isId(g.id)||!name(g.name)||groups.has(g.id))throw Error('Groupe invalide.');groups.add(g.id);}
  for(const m of s.members){if(!exact(m,['id','name','groupId','active'])||!isId(m.id)||!name(m.name)||!groups.has(m.groupId)||typeof m.active!=='boolean'||members.has(m.id))throw Error('Licencié invalide.');members.add(m.id);}
  for(const t of s.slots){if(!exact(t,['id','groupId','label'])||!isId(t.id)||!groups.has(t.groupId)||!name(t.label)||slots.has(t.id))throw Error('Créneau invalide.');slots.add(t.id);}
  for(const c of s.calls){
   if(!exact(c,['date','slotId','marks'])||!date(c.date)||!slots.has(c.slotId)||calls.has(callKey(c))||!Array.isArray(c.marks)||c.marks.length>500)throw Error('Appel invalide.');calls.add(callKey(c));
   const seen=new Set();for(const m of c.marks){if(!exact(m,['memberId','status'])||!members.has(m.memberId)||seen.has(m.memberId)||!['present','absent','excused'].includes(m.status))throw Error('Présence invalide.');seen.add(m.memberId);}
  }
  const clean={groups:s.groups.map(g=>({id:g.id,name:g.name})).sort(byId),members:s.members.map(m=>({id:m.id,name:m.name,groupId:m.groupId,active:m.active})).sort(byId),slots:s.slots.map(t=>({id:t.id,groupId:t.groupId,label:t.label})).sort(byId),calls:s.calls.map(c=>({date:c.date,slotId:c.slotId,marks:c.marks.map(m=>({memberId:m.memberId,status:m.status})).sort((a,b)=>order(a.memberId,b.memberId))})).sort((a,b)=>order(callKey(a),callKey(b)))};
  if(new TextEncoder().encode(JSON.stringify(clean)).length>250000)throw Error('Registre trop volumineux.');
  return clean;
 }
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 // Preserve independent changes. A different change to the same entity/mark
 // must be chosen explicitly. Missing records are represented by null.
 function merge(base,local,remote,choices={}){
  base=normalize(base);local=normalize(local);remote=normalize(remote);
  const conflicts=[];
  function pick(key,b,l,r){
   if(eq(l,r))return l;if(eq(b,l))return r;if(eq(b,r))return l;
   if(choices[key]==='local')return l;if(choices[key]==='remote')return r;
   conflicts.push({key,base:b,local:l,remote:r});return r;
  }
  function records(kind,b,l,r,keyOf,resolve){
   const maps=[b,l,r].map(xs=>new Map(xs.map(x=>[keyOf(x),x])));
   const keys=[...new Set(maps.flatMap(m=>[...m.keys()]))].sort();
   return keys.map(k=>resolve(kind+'/'+k,...maps.map(m=>m.get(k)??null))).filter(x=>x!==null);
  }
  const simple=(kind)=>records(kind,base[kind],local[kind],remote[kind],x=>x.id,pick);
  const calls=records('calls',base.calls,local.calls,remote.calls,callKey,(key,b,l,r)=>{
   if(!l||!r)return pick(key,b,l,r);
   return {date:l.date,slotId:l.slotId,marks:records(key+'/marks',b?.marks??[],l.marks,r.marks,x=>x.memberId,pick)};
  });
  const result={groups:simple('groups'),members:simple('members'),slots:simple('slots'),calls};
  // Referential conflicts (e.g. deleted member with new attendance) must
  // not be silently resolved. Caller keeps both snapshots and reviews.
  if(conflicts.length)return {state:'conflict',conflicts};
  try{return {state:'ready',snapshot:normalize(result)};}catch(e){return {state:'invalid-merge',conflicts:[],message:e.message};}
 }
 return Object.freeze({empty,normalize,merge,callKey});
});
