'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('  function gererTabulationModale('),end=html.indexOf('\n  }',start);
function fixture(){
 const c={document:{activeElement:null},window:{getComputedStyle:n=>({visibility:n.hidden?'hidden':'visible'})}};
 const control=(label,props={})=>({label,tabIndex:0,disabled:false,getClientRects:()=>[{}],closest:()=>null,matches(){return !!this.disabled;},focus(){c.document.activeElement=this;},...props});
 const first=control('premier'),last=control('dernier'),disabled=control('désactivé',{disabled:true}),hidden=control('masqué',{getClientRects:()=>[]});
 function dialog(children,visible=true){return{getClientRects:()=>visible?[{}]:[],querySelectorAll:()=>children,contains:n=>children.includes(n),hasAttribute:()=>true,focus(){c.document.activeElement=this;}};}
 const modal=dialog([first,disabled,hidden,last]);c.document.querySelectorAll=()=>[modal];vm.createContext(c);vm.runInContext(html.slice(start,end+4),c);
 const key=(shiftKey=false,key='Tab')=>{const ev={key,shiftKey,prevented:false,preventDefault(){this.prevented=true;}};c.gererTabulationModale(ev);return ev;};
 return {c,key,first,last,dialog,modal,control};
}
test('Maj+Tab depuis la fenêtre et Tab depuis le dernier contrôle restent dans le dialogue',()=>{
 const f=fixture();f.c.document.activeElement=f.modal;assert.equal(f.key(true).prevented,true);assert.equal(f.c.document.activeElement,f.last);f.key();assert.equal(f.c.document.activeElement,f.first);f.key(true);assert.equal(f.c.document.activeElement,f.last);
});
test('La navigation normale entre les contrôles n’est pas interceptée',()=>{
 const f=fixture();f.c.document.activeElement=f.first;assert.equal(f.key().prevented,false);assert.equal(f.key(false,'Enter').prevented,false);
});
test('Le dernier dialogue visible prend la priorité, sans cibler les boutons désactivés ou cachés',()=>{
 const f=fixture(),inner=f.control('interne');f.c.document.querySelectorAll=()=>[f.modal,f.dialog([inner]),f.dialog([f.control('invisible')],false)];f.c.document.activeElement=f.first;f.key();assert.equal(f.c.document.activeElement,inner);
});
test('Sans fenêtre modale la tabulation reste libre ; sans contrôle le dialogue reçoit le focus',()=>{
 const f=fixture();f.c.document.querySelectorAll=()=>[];assert.equal(f.key().prevented,false);const empty=f.dialog([]);f.c.document.querySelectorAll=()=>[empty];f.key();assert.equal(f.c.document.activeElement,empty);
});
