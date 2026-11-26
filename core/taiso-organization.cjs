'use strict';
// Explicit coach-selected organization. These values never replace a source
// prescription. A repetition window is a budget, not an assumed cadence.
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function validateOrganization(format,mode,settings){
 if(settings===undefined||settings===null)return null;
 const n=(k,a,b)=>integer(settings[k],a,b);
 switch(format){
  case 'Circuit':return exact(settings,['stations','rounds','recoverySeconds','repWindowSeconds','roundRestSeconds'])&&n('stations',2,8)&&n('rounds',1,6)&&n('recoverySeconds',0,180)&&n('roundRestSeconds',0,180)&&(mode==='Durée'?settings.repWindowSeconds===null:n('repWindowSeconds',15,180))?settings:false;
  case 'EMOM':return mode==='Répétitions'&&exact(settings,['stations','rounds'])&&n('stations',2,8)&&n('rounds',1,10)?settings:false;
  case 'Tabata':return mode==='Durée'&&exact(settings,['pairs'])&&n('pairs',1,4)?settings:false;
  case 'AMRAP':return mode==='Répétitions'&&exact(settings,['stations','limitMinutes'])&&n('stations',2,8)&&n('limitMinutes',1,30)?settings:false;
  case 'Séries classiques':
  case 'Pilates / yoga':return exact(settings,['series','recoverySeconds','repWindowSeconds'])&&n('series',1,8)&&n('recoverySeconds',0,180)&&(mode==='Durée'?settings.repWindowSeconds===null:n('repWindowSeconds',15,180))?settings:false;
  case 'Mixte':return exact(settings,['circuit','pilates'])&&validateOrganization('Circuit',mode,settings.circuit)&&validateOrganization('Pilates / yoga',mode,settings.pilates)?settings:false;
  default:return false;
 }
}
function requestedCount(format,settings){
 if(!settings)return null;
 if(['Circuit','EMOM','AMRAP'].includes(format))return settings.stations;
 if(format==='Tabata')return settings.pairs*2;
 return null;
}
function blockOrganization(format,mode,settings,exercises,minutes){
 const budgetSeconds=minutes*60,issues=[];
 if(!settings)return {state:'pending',budgetSeconds,plannedSeconds:null,remainingSeconds:null,issues:['organization-not-configured']};
 const n=exercises.length,target=requestedCount(format,settings);
 if(!n||(target!==null&&n!==target))issues.push('insufficient-stations');
 let plannedSeconds=null;
 const window=e=>mode==='Durée'?e.prescription.effortSeconds:settings.repWindowSeconds;
 if(format==='Circuit'){
  plannedSeconds=settings.rounds*(exercises.reduce((t,e)=>t+window(e),0)+n*settings.recoverySeconds)+Math.max(0,settings.rounds-1)*settings.roundRestSeconds;
 }else if(format==='EMOM')plannedSeconds=n*settings.rounds*60;
 else if(format==='Tabata'){
  if(exercises.some(e=>e.prescription.effortSeconds!==20))issues.push('incompatible-tabata-prescription');
  plannedSeconds=settings.pairs*8*30;
 }else if(format==='AMRAP')plannedSeconds=settings.limitMinutes*60;
 else if(['Séries classiques','Pilates / yoga'].includes(format)){
  plannedSeconds=exercises.reduce((t,e)=>t+settings.series*window(e)+Math.max(0,settings.series-1)*settings.recoverySeconds,0);
 }
 if(plannedSeconds===null||plannedSeconds>budgetSeconds)issues.push('budget-exceeded');
 // Free-form source dosage can include per-side work, series and restrictions.
 // A coach must reconcile the selected organization with that original text.
 return {state:issues.length?'incomplete':'budgeted',budgetSeconds,plannedSeconds,remainingSeconds:plannedSeconds===null?null:budgetSeconds-plannedSeconds,issues,settings,
  requiresPrescriptionReview:true,repetitionWindowIndicative:mode==='Répétitions'};
}
module.exports=Object.freeze({validateOrganization,requestedCount,blockOrganization});
