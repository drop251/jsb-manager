'use strict';
const {authorize}=require('../core/platform-permissions.cjs');
const {adaptExercise,selectTaisoCandidates}=require('../core/catalogue-generator-adapter.cjs');
function createGeneratorSource(pool){
 if(typeof pool?.query!=='function')throw TypeError('Pool requis');
 async function load(actor,discipline,{version,generation}={},purpose='public'){
  const permitted=purpose==='admin-test'?authorize(actor,'generatorTest','run'):purpose==='public'&&authorize(actor,'generator','run',{ownerId:actor?.id});
  if(!permitted)return {ok:false,status:403};
  if(!['taiso','judo'].includes(discipline)||typeof version!=='string'||!/^[A-Za-z0-9_.-]{1,80}$/.test(version)||
     typeof generation!=='string'||!/^[1-9][0-9]{0,18}$/.test(generation))return {ok:false,status:400};
  // One snapshot of the active, journaled release. No draft or archived catalogue.
  const result=await pool.query(`SELECT c.version,c.generation::text AS generation,p.exercise_count AS count,
   COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.reference) FROM (
    SELECT e.reference,e.name,e.family,e.pedagogical_details AS details
    FROM jsb_catalogue.exercises e WHERE e.discipline=c.discipline AND e.version=c.version
   ) x),'[]'::json) AS items
   FROM jsb_catalogue.current_release c JOIN jsb_catalogue.publications p USING(discipline,version)
   WHERE c.discipline=$1 AND c.version=$2 AND c.generation::text=$3`,[discipline,version,generation]);
  const row=result.rows[0];
  if(!row)return {ok:false,status:409};
  if(!Array.isArray(row.items)||row.count!==row.items.length||row.count<1||row.count>2000)return {ok:false,status:503};
  const items=row.items,adapted=items.map(item=>adaptExercise(discipline,item));
  return {ok:true,status:200,source:{discipline,version,generation,count:row.count,items,adapted}};
 }
 async function taisoCandidates(actor,options,criteria,purpose='public'){
  const result=await load(actor,'taiso',options,purpose);
  if(!result.ok)return result;
  const selection=selectTaisoCandidates(result.source.items,criteria);
  if(!selection)return {ok:false,status:400};
  return {ok:true,status:200,discipline:'taiso',version:result.source.version,generation:result.source.generation,...selection};
 }
 return Object.freeze({load,taisoCandidates});
}
module.exports=Object.freeze({createGeneratorSource});
