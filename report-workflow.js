/* v56 — linking and completion controls for the existing report editor. */
(function(global){'use strict';
 const H=global.WBReportWorkflowHost,W=global.WBWorkflow;if(!H||!W)return;
 const $=id=>document.getElementById(id);let info=null,candidates=[],busy=false,lastId=null,refreshSerial=0;
 function message(value,error=false){$('wbReportStatus').textContent=value;$('wbReportStatus').className=error?'wb-flow-error':'wb-flow-muted';}
 function setBusy(v){busy=v;for(const id of ['btnSaveNow','btnCompleteReport','wbLinkOperation','wbCreateOperation','wbPublishReport','wbUnpublishReport','wbEditClosure','wbReopenOperation','wbRefreshLinks'])if($(id))$(id).disabled=v;}
 const currentRef=()=>info?.linked?.ref;
 function render(){
  const linked=info?.linked,op=linked?.operation,state=linked?.status||'independent';
  $('wbReportLinkLabel').textContent=linked?`${linked.vehicle.modele||linked.vehicle.plate} — ${op.operation||'Intervention'}`:'Rapport indépendant — aucune opération du Carnet liée.';
  $('wbReportState').textContent=({planned:'Planifiée',todo:'À prévoir',done:'Terminée',independent:'Indépendant'})[state]||state;$('wbReportState').dataset.status=state;
  $('btnCompleteReport').hidden=!linked||state==='done';$('wbEditClosure').hidden=!linked||state!=='done';$('wbReopenOperation').hidden=!linked||state!=='done';
  $('wbCreateOperation').hidden=!!linked;
  $('wbPublishReport').hidden=!linked||state!=='done';$('wbPublishReport').textContent=info?.published?'Mettre à jour le rapport partagé':'Valider et partager le rapport';
  $('wbUnpublishReport').hidden=!info?.published;
  $('wbReportShareStatus').textContent=info?.published?'Le client consulte la dernière version validée. Les modifications du brouillon restent privées jusqu’à une nouvelle publication.':'Le rapport reste privé, même si l’intervention est terminée.';
  const select=$('wbLinkedOperation');select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Aucune intervention liée — rapport indépendant';select.append(empty);
  const list=[...candidates];if(linked&&!list.some(x=>x.v.id===linked.vehicle.id&&x.o.id===op.id))list.unshift({v:{id:linked.vehicle.id,owner:linked.vehicle.owner},o:op});
  for(const {v,o}of list){const option=document.createElement('option');option.value=o._planningOnly?'planning::'+o.planningId:v.id+'::'+o.id;const period=o.plannedDates?.length?o.plannedDates.join(', '):o.date||'Sans date';option.textContent=`${period} — ${o.operation||'Intervention'} — ${W.status(o)==='done'?'Terminée':W.status(o)==='planned'?'Planifiée':'À prévoir'}${v.owner?' — '+v.owner:''}${o.reportId&&o.reportId!==H.id()?' — Rapport déjà associé':''}`;option.disabled=!!o.reportId&&o.reportId!==H.id();select.append(option);}
  select.value=linked?linked.vehicle.id+'::'+op.id:'';
 }
 async function refresh(loadCandidates=false){
  const rid=H.id();if(!rid)return;const serial=++refreshSerial;
  try{const next=await W.call('reportInfo',{reportId:rid});if(serial!==refreshSerial||H.id()!==rid)return;info=next;
   if(loadCandidates){const data=await W.call('list');if(serial!==refreshSerial||H.id()!==rid)return;const key=W.key(H.state().plate);candidates=data.vehicles.filter(v=>v.id===info?.linked?.vehicle.id||(key&&W.key(v.plate)===key)).flatMap(v=>v.operations.map(o=>({v,o})));candidates.push(...(data.pendingPlanning||[]).filter(x=>key&&W.key(x.vehicle.plate)===key).map(x=>({v:x.vehicle,o:x.operation})));}
   render();if($('wbReportStatus').textContent.startsWith('Chargement du lien'))message(info.linked?'Lien vérifié. « Enregistrer » actualise l’opération sans la terminer.':'Rapport indépendant : aucune opération n’est créée automatiquement.');
  }catch(e){if(H.id()===rid)message('Liaison Carnet indisponible : '+e.message,true);}
 }
 async function save(){
  if(busy||!H.id()||!H.requireSummary())return false;const rid=H.id();setBusy(true);
  try{message('Enregistrement du rapport et de l’opération liée…');await H.flush();const result=await W.call('saveReport',{reportId:rid,report:H.state(),writerId:H.writer,expectedPayload:H.expected()});message(result.message);await refresh();return true;}
  catch(e){message(e.message,true);return false;}finally{setBusy(false);render();}
 }
 async function complete(){
  if(busy||!currentRef()||!H.requireSummary())return;setBusy(true);
  try{await H.flush();const result=await W.closeOperation({...currentRef(),reportId:H.id()},{report:H.state(),writerId:H.writer,expectedPayload:H.expected()});if(result){H.setDate(result.operation.date);message(result.reportShareStatus==='published'?'Rapport enregistré · Intervention terminée · Rapport partagé':result.reportShareStatus==='failed'?'Intervention terminée, mais partage du rapport impossible : '+result.reportShareError:'Rapport enregistré · Carnet mis à jour · Intervention terminée',result.reportShareStatus==='failed');await refresh();}}
  catch(e){message(e.message,true)}finally{setBusy(false);render()}
 }
 async function linkSelected(){
  if(busy||!H.id())return;const value=$('wbLinkedOperation').value,ref=currentRef();
  if(value===((ref?.vehicleId&&ref?.operationId)?ref.vehicleId+'::'+ref.operationId:''))return;
  setBusy(true);
  try{await H.flush();if(!value){const yes=await W.dialog('Détacher le rapport',`<p>L’opération restera enregistrée. Le rapport deviendra indépendant et ne sera plus partagé côté client.</p>`,[{label:'Annuler',value:false},{label:'Détacher',primary:true,value:true}]);if(!yes)return;await W.call('unlinkReport',{reportId:H.id()});}
   else{const [vehicleId,operationId]=value.split('::');await W.call('linkReport',{...(vehicleId==='planning'?{planningId:operationId}:{vehicleId,operationId}),reportId:H.id()});}
   await refresh(true);message('Rattachement enregistré sans création d’une deuxième opération.');
  }catch(e){message(e.message,true)}finally{setBusy(false);render()}
 }
 async function createOperation(){
  if(busy||!H.id()||!H.requireSummary())return;setBusy(true);
  try{await H.flush();const r=H.state();const closure=await W.closureForm({vehicle:{modele:[r.brand,r.model].filter(Boolean).join(' '),plate:r.plate},operation:{operation:r.summary,status:'todo'},report:r,title:'Créer une opération terminée dans le Carnet',shareReportId:H.id()});if(!closure)return;
   const {shareReport,...closureData}=closure;
   const created=await W.call('createCompletedOperation',{reportId:H.id(),report:r,closure:closureData,writerId:H.writer});H.setDate(created.operation.date);
   let shareError=null;if(shareReport){try{await W.call('publishReport',{reportId:H.id()});}catch(e){shareError=e.message||String(e);alert('Opération créée et terminée, mais le rapport n’a PAS été partagé : '+shareError);}}
   await refresh(true);message(shareError?'Opération terminée, partage impossible : '+shareError:shareReport?'Opération terminée et rapport partagé.':'Opération terminée créée et liée au rapport. Aucun rendez-vous ajouté au Planning.',!!shareError);
  }catch(e){message(e.message,true)}finally{setBusy(false);render()}
 }
 async function publish(){
  if(!await save())return;
  const ok=await W.dialog('Partager la version relue du rapport',`<p>Cette version du rapport sera accessible aux personnes autorisées sur la fiche véhicule. Les prochains changements resteront dans le brouillon tant que tu ne publieras pas une nouvelle version.</p>`,[{label:'Annuler',value:false},{label:'Valider et partager',primary:true,value:true}]);if(!ok)return;
  setBusy(true);try{await W.call('publishReport',{reportId:H.id()});await refresh();message('Version validée partagée dans WB Carnet.');}catch(e){message(e.message,true)}finally{setBusy(false);render()}
 }
 function opened(rid,remote){
  if(lastId!==rid){lastId=rid;candidates=[];info=null;render();message('Chargement du lien vers le Carnet…');refresh(false);}
  else if(info&&remote){
   if(remote.linkedOperationId!==info.linked?.operation.id&&(remote.linkedOperationId||info.linked)){if(!busy)refresh(false);}
   else{if(info.linked)info.linked.status=remote.workflowStatus||info.linked.status;info.published=!!remote.reportPublished;render();}
  }
 }
 async function launchFromUrl(){
  const q=new URLSearchParams(location.search),reportId=q.get('reportId'),planningId=q.get('planningId'),vehicleId=q.get('vehicleId'),operationId=q.get('operationId');
  if(reportId){await H.open(reportId);return;}
  if(!planningId&&!(vehicleId&&operationId))return;
  const target=planningId?{planningId}:{vehicleId,operationId};
  try{
   const targetInfo=await W.call('operationInfo',target);
   if(targetInfo.operation.reportId){await H.open(targetInfo.operation.reportId);return;}
   if(q.get('mode')==='ai'){
    if(!global.WBReportAI)await new Promise(resolve=>global.addEventListener('wb-ai-ready',resolve,{once:true}));
    await global.WBReportAI.open({ref:targetInfo.ref,vehicle:targetInfo.vehicle,operation:targetInfo.operation});
   }else{const created=await W.call('createReport',{...targetInfo.ref,report:H.blank(),writerId:H.writer});await H.open(created.reportId);}
  }catch(e){$('reportHomeStatus').textContent=e.message;$('reportHomeStatus').dataset.kind='error';}
 }
 function init(){
  $('wbRefreshLinks').onclick=()=>refresh(true);$('wbLinkOperation').onclick=linkSelected;$('wbCreateOperation').onclick=createOperation;$('btnCompleteReport').onclick=complete;$('wbPublishReport').onclick=publish;
  $('wbEditClosure').onclick=async()=>{try{const result=await W.closeOperation(currentRef());if(result){H.setDate(result.operation.date);await refresh();message('Informations de clôture mises à jour.');}}catch(e){message(e.message,true)}};
  $('wbReopenOperation').onclick=async()=>{try{if(await W.reopen(currentRef()))await refresh()}catch(e){message(e.message,true)}};
  $('wbUnpublishReport').onclick=async()=>{if(!confirm('Retirer l’accès client à ce rapport ?'))return;try{await W.call('unpublishReport',{reportId:H.id()});await refresh()}catch(e){message(e.message,true)}};
  render();launchFromUrl();
 }
 global.WBReportFlow={save,opened,refresh,complete};
 if(H.booted())init();else global.addEventListener('wb-report-ready',init,{once:true});
})(window);
