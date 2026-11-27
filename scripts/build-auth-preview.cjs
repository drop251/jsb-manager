'use strict';
// Build two independent preproduction authentication shells. No deployment.
// Each distribution is an explicit allowlist; never copy the repository.
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const sourceRoot=path.resolve(__dirname,'../apps');
const filesFor=app=>{
 if(!['public','admin'].includes(app))throw TypeError('Application invalide');
 return [app+'/auth.html',app+'/auth-page.mjs','shared/auth-client.mjs','shared/edge-swipe.js',...(app==='public'?['public/offline.html','public/offline.mjs','public/offline-vault.mjs','public/offline-sw.js']:[])];
};
async function build(app,destination){
 const files=filesFor(app),target=path.resolve(destination);
 // Destination must not exist. Refuse overwrites and avoid recursively deleting
 // caller-selected directories on failure.
 await fs.mkdir(target,{recursive:false,mode:0o755});
 const manifest={app,version:'V36',purpose:'preproduction-auth-only',entrypoint:'/'+app+'/auth.html',files:{}};
 for(const name of files){
  const source=name==='shared/edge-swipe.js'?path.resolve(__dirname,'../jsb-edge-swipe.js'):path.join(sourceRoot,name);
  const stat=await fs.lstat(source);
  if(!stat.isFile()||await fs.realpath(source)!==source)throw Error('Source non autorisée');
  const bytes=await fs.readFile(source),output=path.join(target,name);
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.writeFile(output,bytes,{flag:'wx'});
  manifest.files[name]=createHash('sha256').update(bytes).digest('hex');
 }
 await fs.writeFile(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return manifest;
}
if(require.main===module){
 const [app,destination,...extra]=process.argv.slice(2);
 if(!destination||extra.length){console.error('Usage : node scripts/build-auth-preview.cjs public|admin DOSSIER_NEUF');process.exitCode=1;}
 else build(app,destination).then(m=>console.log(m.app+' : '+Object.keys(m.files).length+' fichiers autorisés')).catch(()=>{console.error('Construction refusée');process.exitCode=1;});
}
module.exports=Object.freeze({build,filesFor});
