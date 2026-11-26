'use strict';
const {authorize}=require('../core/platform-permissions.cjs');
const {validatePedagogicalDetails}=require('../core/catalogue-details.cjs');
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
 async function search(actor,discipline,{version,query='',family='',offset=0}={}){
  if(!authorize(actor,'catalogue','read'))return {ok:false,status:403};
  if(!['judo','taiso'].includes(discipline)||typeof version!=='string'||!/^[A-Za-z0-9_.-]{1,80}$/.test(version)||typeof query!=='string'||query.length>120||typeof family!=='string'||family.length>120||!Number.isSafeInteger(offset)||offset<0||offset>100000)return {ok:false,status:400};
  // Literal substring search (no LIKE wildcards), stable ordering and bounded page size.
  // The requested version must still be current in the same statement.
  const r=await pool.query(`WITH current_version AS (
   SELECT version FROM jsb_catalogue.current_release WHERE discipline=$1 AND version=$2
  ), matched AS (
   SELECT e.reference,e.name,e.family FROM jsb_catalogue.exercises e
   JOIN current_version c USING(version)
   WHERE e.discipline=$1 AND ($3='' OR strpos(lower(e.name),lower($3))>0 OR strpos(lower(e.reference),lower($3))>0)
   AND ($4='' OR e.family=$4)
  ), page AS (
   SELECT reference,name,family FROM matched ORDER BY lower(name),reference LIMIT 30 OFFSET $5
  )
  SELECT c.version,(SELECT count(*)::integer FROM matched) AS total,
   COALESCE((SELECT json_agg(row_to_json(p) ORDER BY lower(p.name),p.reference) FROM page p),'[]'::json) AS items
  FROM current_version c`,[discipline,version,query.trim(),family,offset]);
  const row=r.rows[0];
  if(!row)return {ok:false,status:409};
  return {ok:true,status:200,results:{discipline,version:row.version,offset,total:row.total,items:row.items}};
 }
 async function detail(actor,discipline,{version,reference}={}){
  if(!authorize(actor,'catalogue','read'))return {ok:false,status:403};
  if(!['judo','taiso'].includes(discipline)||typeof version!=='string'||!/^[A-Za-z0-9_.-]{1,80}$/.test(version)||typeof reference!=='string'||!reference.trim()||reference.length>80)return {ok:false,status:400};
  const r=await pool.query(`SELECT c.version,e.reference,e.name,e.family,e.pedagogical_details
   FROM jsb_catalogue.current_release c LEFT JOIN jsb_catalogue.exercises e
   ON e.discipline=c.discipline AND e.version=c.version AND e.reference=$3
   WHERE c.discipline=$1 AND c.version=$2`,[discipline,version,reference]);
  const row=r.rows[0];
  if(!row)return {ok:false,status:409};
  if(row.reference===null)return {ok:false,status:404};
  const details=row.pedagogical_details===null?null:validatePedagogicalDetails(discipline,row.pedagogical_details);
  if(row.pedagogical_details!==null&&!details)return {ok:false,status:503};
  return {ok:true,status:200,exercise:{discipline,version:row.version,reference:row.reference,name:row.name,family:row.family,state:details?'complete':'summary',details}};
 }
 return Object.freeze({read,search,detail});
}
module.exports=Object.freeze({createCatalogueReadService});
