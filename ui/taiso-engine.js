/* Taïso session engine. Explicit dependencies; no Judo rules or fields. */
(function(root){
'use strict';
function generer(rep,tous,tout,graine,d){
 const {hasard,sg,niveauOk,niveauEffectifTaiso,estImpact,okTaiso,illustre,melanger,momentsDe,formatsDe,formatParDefaut,construireBlocs,zonesTravaillees,cibleZones,estMobilite,MOTS_CALME,sa,repartirDurees}=d;
 tous=tous.filter(e=>e.typeFiche!=='Technique');
 tout=tout.filter(e=>e.typeFiche!=='Technique');
 const r=hasard(graine),minutes=parseInt(rep.duree,10)||60,parId={};
 tout.forEach(e=>{parId[e.id]=e;});
 const niveauT=niveauEffectifTaiso(rep),doux=rep.groupe==='Gym douce';
 const base=tous.filter(e=>sg(e).indexOf(rep.groupe)>=0&&niveauOk(e,niveauT)&&(!doux||(!estImpact(e)&&e.accessibilite!=='Publics entraînés uniquement'))&&okTaiso(e,rep));
 const routineIDs=rep.routine||[],routine=routineIDs.map(id=>parId[id]).filter(e=>e&&niveauOk(e,niveauT)&&(!doux||e.accessibilite!=='Publics entraînés uniquement')&&okTaiso(e,rep));
 const minRoutine=Math.max(5,Math.min(12,routine.length)),reste=Math.max(15,minutes-minRoutine);
 const phases=[['Mobilité',minRoutine],['Échauffement',Math.round(reste*.14),4],['Corps de séance',Math.round(reste*.64),6],['Retour au calme',Math.max(3,Math.round(reste*(rep.calme==='Respiration et relaxation'?.12:rep.calme==='Étirements'?.05:.08))),4],['Étirements',0,4]];
 phases[4][1]=Math.max(5,minutes-phases.slice(0,-1).reduce((a,p)=>a+p[1],0));
 const ecart=phases.reduce((a,p)=>a+p[1],0)-minutes;
 if(ecart)phases[2][1]-=ecart;
 if(phases[2][1]<1)throw Error('Durée insuffisante pour les phases choisies');
 const pris={},resultat=[],manques=[];
 if(routine.length<routineIDs.length)manques.push('routine de mobilité : exercices manquants ou incompatibles');
 routine.forEach(e=>{pris[e.id]=1;});
 const obj=rep.objectif&&rep.objectif.indexOf('Vari')!==0?rep.objectif:'',eviter=rep.eviter||{};
 function score(e){let s=r()*1.5;if(eviter[e.id])s-=3;if(obj&&e.categorie===obj)s+=2.5;if(rep.illustres&&illustre(e))s+=2.5;if(rep.binome&&e.format==='Binôme')s+=2;return s;}
 function choisir(pool,n,diversifier){
  const tri=melanger(pool.filter(e=>!pris[e.id]),r).map(e=>[score(e),e]).sort((a,b)=>b[0]-a[0]).map(x=>x[1]),out=[],parCat={};
  tri.forEach(e=>{if(out.length>=n)return;if(diversifier&&(parCat[e.categorie]||0)>=Math.ceil(n/2)&&e.categorie!==obj)return;out.push(e);parCat[e.categorie]=(parCat[e.categorie]||0)+1;pris[e.id]=1;});
  if(out.length<n)tri.forEach(e=>{if(out.length<n&&!pris[e.id]){out.push(e);pris[e.id]=1;}});return out;
 }
 const mom=m=>e=>momentsDe(e).indexOf(m)>=0;
 const formatT=rep.format&&formatsDe(rep.groupe).indexOf(rep.format)>=0?rep.format:formatParDefaut(rep.groupe);
 const blocsCorps=construireBlocs(formatT,base.filter(mom('Corps de séance')),phases[2][1],doux,choisir,niveauT,{intensite:rep.intensite||0,participants:rep.participants||0}),zones=zonesTravaillees(blocsCorps);
 function cible(pool,n){const top=pool.filter(e=>cibleZones(e,zones)>0).sort((a,b)=>cibleZones(b,zones)-cibleZones(a,zones));const a=choisir(top.slice(0,Math.max(n*2,4)),Math.ceil(n/2),false);return a.concat(choisir(pool,n-a.length,false));}
 phases.forEach((ph,i)=>{
  const min=ph[1];let ex;
  if(i===2){const items=[].concat.apply([],blocsCorps.map(b=>b.items)),occupe=blocsCorps.reduce((t,b)=>t+b.minutes,0);if(!items.length)manques.push(ph[0]);resultat.push({nom:ph[0],minutes:min,blocs:blocsCorps,format:formatT,niveau:niveauT,transitions:Math.max(0,Math.round(min-occupe)),exercices:items});return;}
  if(i===0){ex=routine;if(!ex.length)manques.push('routine de mobilité (non choisie)');}
  else{
   let n=Math.max(1,Math.round(min/ph[2])),pool;
   const finS=()=>base.filter(mom('Fin de séance')),calme=e=>MOTS_CALME.test(sa(e.nom+' '+e.description));
   if(i===3){pool=finS().filter(calme);if(!pool.length)pool=finS();}
   else if(i===4){pool=finS().filter(e=>!calme(e));if(!pool.length)pool=finS();}
   else{pool=base.filter(e=>mom('Échauffement')(e)&&!estMobilite(e)&&niveauOk(e,niveauT)&&(!doux||!estImpact(e)));if(pool.length<3)pool=base.filter(e=>mom('Échauffement')(e)&&!estMobilite(e)&&(!doux||!estImpact(e))&&niveauOk(e,niveauT));n=Math.min(4,Math.max(3,Math.round(min/2)));}
   ex=i===1||i===4?cible(pool,n):choisir(pool,n,false);if(ex.length<n)manques.push(ph[0]);
  }
  if(ex.length>min)ex=ex.slice(0,min);
  const durees=repartirDurees(min,ex.length);resultat.push({nom:ph[0],minutes:min,transitions:0,exercices:ex.map((e,k)=>({e,duree:durees[k]}))});
 });
 return {phases:resultat,manques};
}
root.JSBTaisoEngine={generer};
})(typeof window!=='undefined'?window:globalThis);
