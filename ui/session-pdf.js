/* JSB Manager — two discipline-specific A4 layouts; local jsPDF only. */
(function(root){
'use strict';
const navy=[31,40,57],gold=[180,139,80],gray=[244,245,239],ink=[36,42,50],muted=[83,91,100];
const text=v=>String(v==null?'':v).replace(/[’‘]/g,"'").replace(/[–—]/g,'-').replace(/œ/g,'oe').replace(/→/g,'>').replace(/[  ]/g,' ');
function layout(J,logo,discipline,blank){
 const d=new J({unit:'pt',format:'a4'}),W=d.internal.pageSize.getWidth(),H=d.internal.pageSize.getHeight(),M=34,C=W-2*M;let y=0;
 function font(size=10,bold=false,color=ink){d.setFont('helvetica',bold?'bold':'normal');d.setFontSize(size);d.setTextColor(...color);}
 function lines(v,width,size=10,bold=false){font(size,bold);return d.splitTextToSize(text(v),width);}
 function write(v,x,yy,size=10,bold=false,color=ink){font(size,bold,color);d.text(text(v),x,yy);}
 function header(){
  d.setFillColor(...navy);d.rect(0,0,W,98,'F');
  write('JSB MANAGER · '+discipline.toUpperCase(),M,25,10,true,gold);
  write(discipline==='Judo'?'Fiche de séance Judo':'Fiche de séance Taïso',M,53,23,true,[255,255,255]);
  write(blank?'Fiche vierge':discipline==='Judo'?'Fiche pédagogique':'Fiche coach',M,74,10,false,[230,232,236]);
  if(logo)try{d.addImage(logo,'PNG',W-M-55,19,55,55);}catch(e){}
  y=118;
 }
 function room(h){if(y+h>H-44){d.addPage();header();}}
 function paragraph(v,{size=10,bold=false,color=ink}={}){
  if(!v)return;
  for(const line of lines(v,C,size,bold)){room(size+5);write(line,M,y+size,size,bold,color);y+=size+5;}y+=3;
 }
 function heading(v){room(35);write(v,M,y+14,13,true,navy);y+=23;}
 function cards(fields){
  const gap=8,w=(C-gap)/2;
  for(let i=0;i<fields.length;i+=2){
   const pair=fields.slice(i,i+2),ls=pair.map(f=>lines(f[1]||'________________',w-20,11,true));
   const h=Math.max(...ls.map(l=>l.length))*14+29;
   if(h>H-170){for(const f of pair){paragraph(f[0],{bold:true,color:muted});paragraph(f[1]||'________________');}continue;}
   room(h+8);
   pair.forEach((f,j)=>{const x=M+j*(w+gap);d.setFillColor(...gray);d.roundedRect(x,y,w,h,5,5,'F');write(f[0],x+10,y+13,9,false,muted);font(11,true);d.text(ls[j],x+10,y+27,{lineHeightFactor:1.25});});y+=h+gap;
  }
 }
 function phase(name,n,mins){room(53);write(n?String(n).padStart(2,'0'):'',M,y+13,11,true,gold);const x=M+(n?27:0);const ls=lines(name,C-(n?27:0)-75,12,true);font(12,true,navy);d.text(ls,x,y+13);font(10,false,muted);d.text(mins==null?'Durée à préciser':mins+' min',W-M,y+13,{align:'right'});y+=Math.max(23,ls.length*15+7);d.setDrawColor(...gold);d.line(M,y,M+C,y);y+=7;}
 function notes(title,value){heading(title);if(value)paragraph(value);else{room(45);d.setDrawColor(190,195,201);d.roundedRect(M,y,C,42,4,4);y+=50;}}
 function bar(groups){
  const total=groups.reduce((a,g)=>a+(g.minutes||0),0);heading('Répartition de la séance');
  if(!total){paragraph('Durées à préciser');return;}
  room(62);let x=M;const colors=[[135,150,168],gold,[120,152,138]];
  groups.forEach((g,i)=>{const w=C*(g.minutes||0)/total;if(w>0){d.setFillColor(...colors[i]);d.rect(x,y,w,13,'F');x+=w;}});y+=19;
  groups.forEach(g=>paragraph(g.name+' : '+(g.minutes==null?'non renseigné':g.minutes+' min'),{size:9,color:muted}));
 }
 function tableHeader(){room(35);d.setFillColor(...navy);d.rect(M,y,C,22,'F');write('Exercice',M+7,y+14,10,true,[255,255,255]);write('Dosage',M+C*.55+7,y+14,10,true,[255,255,255]);write('Récup.',M+C*.82+7,y+14,10,true,[255,255,255]);y+=22;}
 function row(name,dose,rest){
  const widths=[C*.55,C*.27,C*.18],values=[name,dose,rest],ls=values.map((v,i)=>lines(v||'-',widths[i]-14,10,i===0)),max=Math.max(...ls.map(v=>v.length));
  for(let start=0;start<max;){if(H-44-y<24){d.addPage();header();tableHeader();}const count=Math.max(1,Math.min(max-start,Math.floor((H-44-y-10)/13)));const ht=count*13+10;let x=M;
   ls.forEach((l,i)=>{d.setDrawColor(210,214,218);d.rect(x,y,widths[i],ht);font(10,i===0);const part=l.slice(start,start+count);if(part.length)d.text(part,x+7,y+13,{lineHeightFactor:1.3});x+=widths[i];});y+=ht;start+=count;
  }
 }
 function finish(){const n=d.getNumberOfPages();for(let i=1;i<=n;i++){d.setPage(i);font(8,false,muted);d.text('JUDO SANS BARRIÈRE - Progresser à sa manière',M,H-24);d.text(i+' / '+n,W-M,H-24,{align:'right'});}return d.output('blob');}
 header();return {paragraph,heading,cards,phase,notes,bar,tableHeader,row,finish};
}
function minutes(items,durations,override){if(override!=null&&override!==''&&Number.isFinite(Number(override)))return Number(override);let values=items.map(e=>parseFloat(durations[e.id])).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0):null;}
function field(l,v){return v?l+' : '+v:'';}
function details(L,e,p,judo){
 if(e.description)L.paragraph(e.description);
 const fields=judo?[['Compétence ciblée',e.competenceCiblee],['Rôle pédagogique',e.rolePedagogique],['Prérequis',e.prerequis],['Opposition',e.niveauOpposition],['Organisation Tori / Uke',e.organisation]]:[['Matériel',e.materielDetail||e.equipement],['Travail',p.travail],['Tours',p.tours],['Muscles cibles',e.muscles]];
 for(const [k,v] of fields)if(v)L.paragraph(field(k,v),{size:9});
 for(const [k,v] of [['Critère de réussite',e.critere],['Point de sécurité',e.vigilance],['Variante plus facile',e.varianteFacile],['Variante plus difficile',e.varianteDifficile],['Accessibilité',e.accessibilite]])if(v)L.paragraph(field(k,v),{size:9,bold:k==='Point de sécurité'});
}
function judo(J,logo,info,phases,items,durations,plan,blank){
 const L=layout(J,logo,'Judo',blank),all=items.flat(),competences=[...new Set(all.map(e=>e.competenceCiblee).filter(Boolean))];
 L.cards([['Catégorie',info.groupe||info.public],['Durée',info.duree],['Compétence',competences.join(' ; ')],['Famille',info.thematique]]);
 L.heading('Objectif pédagogique');L.paragraph(info.objectif|| (blank?'________________________________':'Non renseigné'));
 phases.forEach((name,i)=>{const list=items[i]||[];L.phase(name,i+1,minutes(list,durations,info.tempsPhases&&info.tempsPhases[i]));if(info.reperesPhases)L.paragraph(info.reperesPhases[i]);if(!list.length)L.paragraph(blank?'Situation : __________________________________':'Aucun exercice enregistré');
 list.forEach(e=>{const p=plan[e.id]||{};L.heading(e.nom);L.paragraph([field('Dosage',p.dosage||e.dosage),field('Temps indicatif',durations[e.id]?durations[e.id]+' min':'')].filter(Boolean).join(' · '));details(L,e,p,true);});});
 if(info.vigilance)L.notes('Points de vigilance',info.vigilance);L.notes('Bilan pédagogique',info.note);return L.finish();
}
function taiso(J,logo,info,phases,items,durations,plan,blank){
 const L=layout(J,logo,'Taïso',blank);
 L.cards([['Public',info.groupe||info.public],['Durée',info.duree],['Objectif',info.objectif],['Effectif',info.participants],['Matériel',info.materiel],['Niveau',info.niveau]]);
 const sums=phases.map((_,i)=>minutes(items[i]||[],durations));
 const combine=ids=>{const v=ids.map(i=>sums[i]).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0):null;};
 L.bar([{name:'Échauffement',minutes:combine([0,1])},{name:'Travail',minutes:sums[2]},{name:'Retour au calme',minutes:combine([3,4])}]);
 if(info.intensite)L.paragraph(field('Intensité',info.intensite));
 phases.forEach((name,i)=>{const list=items[i]||[];L.phase(name,null,sums[i]);if(i===2&&info.format)L.paragraph(field('Format',info.format),{bold:true});if(!list.length){L.paragraph(blank?'Exercice : __________________________________':'Aucun exercice enregistré');return;}
 let bloc=null;list.forEach((e,index)=>{const p=plan[e.id]||{},next=p.bloc||'';if(next!==bloc||index===0){bloc=next;if(bloc)L.heading(bloc);L.tableHeader();}L.row(e.nom,p.dosage||e.dosage,p.recuperation||e.recuperation||'');});
 list.forEach(e=>{const p=plan[e.id]||{};L.heading(e.nom);details(L,e,p,false);});});
 L.notes('Sécurité et adaptations',[info.vigilance,info.adaptations].filter(Boolean).join('\n'));L.notes('Observations du coach',info.note);return L.finish();
}
root.JSBSessionPDF={judo,taiso};
})(typeof window!=='undefined'?window:globalThis);
