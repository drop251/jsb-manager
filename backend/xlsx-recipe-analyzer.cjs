'use strict';
const {execFile}=require('node:child_process');
const {isAbsolute,join}=require('node:path');
const {analyzeWorkbook}=require('../core/catalogue-workbook-analysis.cjs');
const LIMIT=4*1024*1024;
const invalid=code=>({valid:false,errorCount:1,errors:[{row:0,field:'file',code}],mode:'xlsx-recipe',publishable:false});
function createXlsxRecipeAnalyzer({pythonExecutable}={}){
 if(typeof pythonExecutable!=='string'||!isAbsolute(pythonExecutable))throw TypeError('Interpréteur Python absolu requis');
 const script=join(__dirname,'../scripts/read-taiso-xlsx-stream.py');
 let busy=false;
 return async function analyze(base64,{discipline='taiso',version}={}){
  if(typeof base64!=='string'||base64.length>Math.ceil(LIMIT/3)*4||!base64.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))return invalid('invalid-xlsx');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length>LIMIT||bytes.toString('base64')!==base64)return invalid('invalid-xlsx');
  if(busy)return null;
  busy=true;
  try{
   const output=await new Promise((resolve,reject)=>{
    const child=execFile(pythonExecutable,['-I','-B',script],{
     encoding:'utf8',timeout:15000,maxBuffer:8*1024*1024,killSignal:'SIGKILL',
     env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}
    },(error,stdout)=>error?reject(error):resolve(stdout));
    child.stdin.on('error',()=>{});
    child.stdin.end(bytes);
   });
   try{return analyzeWorkbook(JSON.parse(output),discipline,version);}
   catch{return invalid('invalid-xlsx');}
  }catch(error){
   if(error?.code===2)return invalid('invalid-xlsx');
   return null;
  }finally{busy=false;}
 };
}
module.exports=Object.freeze({createXlsxRecipeAnalyzer});
