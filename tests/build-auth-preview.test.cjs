'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {build,filesFor}=require('../scripts/build-auth-preview.cjs');
async function walk(dir,prefix=''){
 const out=[];
 for(const e of await fs.readdir(dir,{withFileTypes:true})){
  const name=prefix+e.name;
  if(e.isDirectory())out.push(...await walk(path.join(dir,e.name),name+'/'));
  else{assert.ok(e.isFile());out.push(name);}
 }
 return out.sort();
}
test('Deux distributions de préproduction strictement isolées et reproductibles',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'jsb-build-'));
 try{
  assert.throws(()=>filesFor('../backend'),TypeError);
  for(const app of ['public','admin']){
   const dest=path.join(tmp,app),m=await build(app,dest);
   const expected=[app+'/auth.html',app+'/auth-page.mjs','shared/auth-client.mjs','shared/edge-swipe.js',...(app==='public'?['public/offline.html','public/offline.mjs','public/offline-sw.js']:[])];
   assert.deepEqual(await walk(dest),[...expected,'manifest.json'].sort());
   assert.equal(m.entrypoint,'/'+app+'/auth.html');
   assert.equal(m.purpose,'preproduction-auth-only');
   for(const name of expected){
    const bytes=await fs.readFile(path.join(dest,name));
    assert.deepEqual(bytes,await fs.readFile(name==='shared/edge-swipe.js'?path.resolve(__dirname,'../jsb-edge-swipe.js'):path.resolve(__dirname,'../apps',name)));
    assert.equal(m.files[name],createHash('sha256').update(bytes).digest('hex'));
   }
   assert.deepEqual(JSON.parse(await fs.readFile(path.join(dest,'manifest.json'),'utf8')),m);
   const html=await fs.readFile(path.join(dest,app,'auth.html'),'utf8');
   assert.match(html,/<fieldset id="fields" disabled/);
   assert.equal(html.includes('id="mfa"'),app==='admin');
   assert.equal(html.includes('Prototype interactif'),false);
   await assert.rejects(build(app,dest),{code:'EEXIST'});
   assert.deepEqual(await build(app,path.join(tmp,app+'-bis')),m);
  }
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
