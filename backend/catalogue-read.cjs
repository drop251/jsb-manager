'use strict';
const {authorize}=require('../core/platform-permissions.cjs');
function createCatalogueReadService(pool){
 if(typeof pool?.query!=='function')throw TypeError('Pool requis');
 async function read(actor,discipline){
  if(!authorize(actor,'catalogue','read'))return {ok:false,status:403};
  if(!['judo','taiso'].includes(discipline))return {ok:false,status:400};
  // One SQL statement: a consistent published revision, never unpublished content.
  const r=await pool.query(`SELECT r.version,r.published_at,
   (SELECT count(*)::integer FROM jsb_catalogue.exercises e WHERE e.discipline=r.discipline AND e.version=r.version) AS count,
   COALESCE((SELECT json_agg(row_to_json(f) ORDER BY f.family) FROM
     (SELECT e.family,count(*)::integer AS count FROM jsb_catalogue.exercises e WHERE e.discipline=r.discipline AND e.version=r.version GROUP BY e.family) f),'[]'::json) AS families
   FROM jsb_catalogue.current_release c JOIN jsb_catalogue.releases r USING(discipline,version)
   WHERE c.discipline=$1`,[discipline]);
  const row=r.rows[0];
  return {ok:true,status:200,catalogue:row?{discipline,state:'published',version:row.version,publishedAt:Number(row.published_at),count:row.count,families:row.families}:{discipline,state:'unpublished',version:null,publishedAt:null,count:0,families:[]}};
 }
 return Object.freeze({read});
}
module.exports=Object.freeze({createCatalogueReadService});
