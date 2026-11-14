/* WheelerBrothers v56 — shared UI for the server-authoritative workflow. */
(function(global){'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 const status=o=>o?.status||'done';
 const done=o=>status(o)==='done';
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
 function dialog(title,body,buttons,setup){
  return new Promise(resolve=>{
   const d=document.createElement('dialog');d.className='wb-flow-dialog no-print';d.setAttribute('aria-label',title);
   d.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" data-close aria-label="Fermer">✕</button></header><div class="wb-flow-body">${body}<p class="wb-flow-error" role="alert"></p></div><footer></footer>`;
   const end=value=>{d.close();d.remove();resolve(value);};
   for(const b of buttons){const el=document.createElement('button');el.type='button';el.textContent=b.label;if(b.primary)el.className='wb-primary';el.onclick=async()=>{try{const result=b.read?await b.read(d):b.value;if(result!==undefined)end(result);}catch(e){d.querySelector('[role="alert"]').textContent=e.message;}};d.querySelector('footer').append(el);}
   d.querySelector('[data-close]').onclick=()=>end(null);d.addEventListener('cancel',e=>{e.preventDefault();end(null);});document.body.append(d);if(setup)setup(d);d.showModal();
  });
 }
 // v56.1: authenticated callable transport, deliberately independent of FCM.
 // The optional Firebase-Instance-ID-Token header is not used by wbWorkflow.
 // Do NOT await a push token or register a service worker before saving data.
 function callableError(code,message,details){
  const error=new Error(message);error.code='functions/'+code;
  if(details!==undefined)error.details=details;
  return error;
 }
 const callableCodes=new Set(['cancelled','unknown','invalid-argument','deadline-exceeded',
  'not-found','already-exists','permission-denied','resource-exhausted','failed-precondition',
  'aborted','out-of-range','unimplemented','internal','unavailable','data-loss','unauthenticated']);
 function responseError(response,body){
  const fallback=({400:'invalid-argument',401:'unauthenticated',403:'permission-denied',
   404:'not-found',409:'aborted',429:'resource-exhausted',500:'internal',501:'unimplemented',
   503:'unavailable',504:'deadline-exceeded'})[response.status]||'internal';
  const status=String(body?.error?.status||'').toLowerCase().replace(/_/g,'-');
  return callableError(callableCodes.has(status)?status:fallback,
   body?.error?.message||'La synchronisation a été refusée par le serveur.',body?.error?.details);
 }
 async function raw(action,args={}){
  await global.atelierReady;
  const app=global.firebase.app();
  const user=app.auth().currentUser;
  if(!user)throw callableError('unauthenticated','Reconnecte-toi à l’Atelier avant d’enregistrer.');
  const projectId=String(app.options.projectId||'');
  if(!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)){
   throw callableError('failed-precondition','Configuration du projet Firebase invalide.');
  }
  const idToken=await user.getIdToken();
  if(!idToken)throw callableError('unauthenticated','La session Atelier ne fournit pas de jeton valide.');
  const headers={'Content-Type':'application/json','Authorization':'Bearer '+idToken};
  // Preserve App Check when the application has enabled it. Never bypass a failed check.
  if(typeof app.appCheck==='function'){
   const check=await app.appCheck().getToken(false);
   if(!check?.token)throw callableError('failed-precondition','Vérification App Check indisponible.');
   headers['X-Firebase-AppCheck']=check.token;
  }
  const controller=new AbortController();
  let timedOut=false;
  const timer=global.setTimeout(()=>{timedOut=true;controller.abort();},70000);
  try{
   // No automatic retry: a network failure can occur after a transaction was committed.
   const response=await global.fetch('https://europe-west1-'+projectId+'.cloudfunctions.net/wbWorkflow',{
    method:'POST',headers,body:JSON.stringify({data:{...args,action}}),
    mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal
   });
   let body;
   try{body=await response.json();}
   catch(error){
    if(timedOut)throw error;
    throw callableError('internal','Réponse serveur illisible. Vérifie le Planning avant de réessayer.');
   }
   if(!response.ok||body?.error)throw responseError(response,body);
   if(!body||typeof body!=='object')throw callableError('internal','Réponse serveur invalide.');
   if(Object.prototype.hasOwnProperty.call(body,'data'))return body.data;
   if(Object.prototype.hasOwnProperty.call(body,'result'))return body.result;
   throw callableError('internal','Réponse serveur incomplète. Vérifie le Planning avant de réessayer.');
  }catch(error){
   if(timedOut)throw callableError('deadline-exceeded','Délai de réponse dépassé. L’enregistrement peut avoir abouti : vérifie le Planning avant de réessayer.');
   if(error?.code)throw error;
   throw callableError('unavailable','Connexion au serveur interrompue. Vérifie le Planning avant de réessayer.');
  }finally{global.clearTimeout(timer);}
 }

 async function call(action,args={}){
  let request={...args};for(let n=0;n<6;n++){
   try{return await raw(action,request);}catch(error){
    const detail=error.details;
    if(detail?.type==='conflicts'){
     const choice=await dialog('Informations déjà renseignées',`<p>Les données du Carnet ne seront pas remplacées sans ton accord. Une valeur vide ne les efface jamais.</p>${detail.conflicts.map((c,i)=>`<div class="wb-flow-conflict"><strong>${esc(c.label)}</strong><label><input type="radio" name="conf${i}" value="keep" checked>Conserver dans le Carnet</label><pre>${esc(c.current)}</pre><label><input type="radio" name="conf${i}" value="incoming">Utiliser la nouvelle valeur</label><pre>${esc(c.incoming)}</pre></div>`).join('')}`,[{label:'Annuler',value:null},{label:'Confirmer les choix',primary:true,read:d=>Object.fromEntries(detail.conflicts.map((c,i)=>[c.key,{expected:c.current,choice:d.querySelector(`input[name="conf${i}"]:checked`).value}]))}]);
     if(!choice)throw new Error('Enregistrement annulé : aucune donnée du Carnet remplacée.');request.resolutions={...request.resolutions,...choice};continue;
    }
    if(detail?.type==='merge'){
     const yes=await dialog('Rapprocher les deux opérations',`<p>${esc(detail.message)}</p><p>Les différences de date, de kilométrage, de temps et de rémunération te seront présentées. L’ancienne opération sera archivée ; ses données seront conservées.</p>`,[{label:'Annuler',value:false},{label:'Rapprocher',primary:true,value:true}]);
     if(!yes)throw new Error('Rapprochement annulé.');request.confirmMerge=true;continue;
    }
    throw error;
   }
  }throw new Error('Les données changent sur un autre appareil. Rouvre l’intervention puis réessaie.');
 }
 async function closureForm({vehicle={},operation={},report=null,title,shareReportId=null}={}){
  const initialDate=(report?.date||operation.date||today());
  return dialog(title||(done(operation)?'Modifier les informations de clôture':'Terminer l’intervention'),`<p><strong>${esc(vehicle.modele||[vehicle.marque||vehicle.brand,vehicle.modeleDetail||vehicle.model].filter(Boolean).join(' '))}</strong><br>${esc(vehicle.plate||report?.plate||'')}<br>${esc(operation.operation||report?.summary||'Intervention')}</p><p class="wb-flow-muted">Les valeurs concernent l’ensemble de l’intervention. Les dates prévues dans le Planning sont conservées. Un champ vide conserve une valeur déjà enregistrée.</p><label for="wbCloseDate">Date réelle de réalisation</label><input id="wbCloseDate" type="date" value="${esc(initialDate)}" required><div class="wb-flow-grid"><div><label for="wbCloseHours">Temps passé (heures)</label><input id="wbCloseHours" type="text" inputmode="decimal" placeholder="Ex. 2,5 = 2 h 30" value="${esc(operation.temps??'')}"></div><div><label for="wbClosePay">Argent perçu (€)</label><input id="wbClosePay" type="text" inputmode="decimal" placeholder="0 pour une intervention non rémunérée" value="${esc(operation.remuneration??'')}"></div></div>${shareReportId?`<label class="wb-flow-share-option" style="display:flex;align-items:flex-start;gap:9px;margin-top:14px"><input type="checkbox" id="wbCloseShareReport" checked style="width:auto;margin-top:3px"><span>Partager également le rapport lié avec le client (si le véhicule est partagé et le rapport validable)</span></label>`:''}`, [{label:'Annuler',value:null},{label:done(operation)?'Enregistrer la clôture':'Confirmer la fin de l’intervention',primary:true,read:d=>{
   const date=d.querySelector('#wbCloseDate').value;if(!date)throw new Error('Indique la date réelle de réalisation.');
   const read=id=>{const value=d.querySelector(id).value.trim().replace(',','.');if(value!==''&&(!/^\d+(\.\d+)?$/.test(value)||!Number.isFinite(Number(value))))throw new Error('Indique des valeurs positives ou zéro.');return value;};
   return {date,temps:read('#wbCloseHours'),remuneration:read('#wbClosePay'),shareReport:!!(shareReportId&&d.querySelector('#wbCloseShareReport')?.checked)};
  }}]);
 }
 async function closeOperation(ref,extra={}){
  const info=await call('operationInfo',ref);const shareReportId=extra.reportId||info.operation?.reportId||null;
  const closure=await closureForm({...info,report:extra.report,shareReportId});if(!closure)return null;
  const {shareReport,...closureData}=closure;
  const op=info.operation;const expectedClosure=info.ref.vehicleId?{date:op.date||'',temps:op.temps??null,remuneration:op.remuneration??null,status:status(op)}:null;
  const result=await call('complete',{...ref,...extra,closure:closureData,expectedClosure});
  global.dispatchEvent(new CustomEvent('wb-workflow-updated',{detail:result}));
  if(shareReport&&shareReportId){
   try{await call('publishReport',{reportId:shareReportId});result.reportShareStatus='published';}
   catch(e){result.reportShareStatus='failed';result.reportShareError=e.message||String(e);
    alert('Intervention bien terminée, mais le rapport n’a PAS été partagé : '+result.reportShareError+'\n\nOuvre le rapport et utilise « Valider et partager le rapport » après correction.');}
  }else if(shareReportId)result.reportShareStatus='private';
  return result;
 }
 async function reopen(ref){const ok=await dialog('Réouvrir l’intervention',`<p>L’intervention ne sera plus visible dans WB Carnet. Le rapport restera enregistré mais ne sera plus partagé. Les PDF déjà téléchargés ne peuvent pas être retirés.</p>`,[{label:'Annuler',value:false},{label:'Réouvrir',primary:true,value:true}]);if(!ok)return null;const r=await call('reopen',ref);global.dispatchEvent(new CustomEvent('wb-workflow-updated',{detail:r}));return r;}
 function reportUrl(ref,mode='manual'){const q=new URLSearchParams({mode});for(const k of ['planningId','vehicleId','operationId','reportId'])if(ref[k])q.set(k,ref[k]);return 'rapport.html?'+q.toString();}
 async function selectExistingReport(ref){
  const info=await call('operationInfo',ref);const {spaceId}=await global.atelierReady;
  const snap=await db.collection('spaces').doc(spaceId).collection('reports').orderBy('updatedAt','desc').limit(200).get({source:'server'});
  const reports=snap.docs.flatMap(d=>{let payload;try{payload=JSON.parse(d.data().payload);}catch{return [];}return key(payload.plate)===key(info.vehicle.plate)?[{id:d.id,title:payload.summary||d.data().title||'Rapport sans résumé',date:payload.date||'',linked:d.data().linkedOperationId}]:[];});
  if(!reports.length){alert('Aucun rapport enregistré pour cette plaque dans les 200 derniers rapports. Ouvre un rapport plus ancien depuis le générateur pour le rattacher.');return;}
  const rid=await dialog('Associer un rapport existant',`<label for="wbExistingReport">Rapports de ${esc(info.vehicle.plate)}</label><select id="wbExistingReport"><option value="">Sélectionner…</option>${reports.map(r=>`<option value="${esc(r.id)}">${esc([r.date,r.title].filter(Boolean).join(' — '))}${r.linked?' — déjà lié (rapprochement requis)':''}</option>`).join('')}</select>`,[{label:'Annuler',value:null},{label:'Associer',primary:true,read:d=>{const v=d.querySelector('select').value;if(!v)throw new Error('Sélectionne un rapport.');return v;}}]);
  if(rid){await call('linkReport',{...info.ref,reportId:rid});location.href=reportUrl({reportId:rid});}
 }
 async function reportAction(ref){
  const info=await call('operationInfo',ref);
  if(!info.ref.vehicleId){alert('Renseigne une plaque ou sélectionne un véhicule pour créer un rapport lié.');return;}
  if(info.operation.reportId){location.href=reportUrl({reportId:info.operation.reportId});return;}
  const mode=await dialog('Créer ou associer un rapport',`<p><strong>${esc(info.vehicle.modele||info.vehicle.plate)}</strong><br>${esc(info.operation.operation)}</p><p>Le rapport sera rattaché à cette opération, sans en créer une deuxième et sans terminer les travaux.</p>`,[{label:'Annuler',value:null},{label:'Associer un rapport existant',value:'existing'},{label:'Créer avec l’IA',value:'ai'},{label:'Créer un rapport classique',primary:true,value:'manual'}]);
  if(mode==='existing')await selectExistingReport(info.ref);else if(mode)location.href=reportUrl(info.ref,mode);
 }
 global.WBWorkflow=Object.freeze({call,raw,dialog,closeOperation,closureForm,reopen,reportAction,selectExistingReport,reportUrl,status,done,escape:esc,key,today});
})(window);
