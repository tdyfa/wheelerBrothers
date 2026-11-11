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
 async function raw(action,args={}){await global.atelierReady;const fn=firebase.app().functions('europe-west1').httpsCallable('wbWorkflow',{timeout:70000});return (await fn({action,...args})).data;}
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
 async function closureForm({vehicle={},operation={},report=null,title}={}){
  const initialDate=(report?.date||operation.date||today());
  return dialog(title||(done(operation)?'Modifier les informations de clôture':'Terminer l’intervention'),`<p><strong>${esc(vehicle.modele||[vehicle.marque||vehicle.brand,vehicle.modeleDetail||vehicle.model].filter(Boolean).join(' '))}</strong><br>${esc(vehicle.plate||report?.plate||'')}<br>${esc(operation.operation||report?.summary||'Intervention')}</p><p class="wb-flow-muted">Les valeurs concernent l’ensemble de l’intervention. Les dates prévues dans le Planning sont conservées. Un champ vide conserve une valeur déjà enregistrée.</p><label for="wbCloseDate">Date réelle de réalisation</label><input id="wbCloseDate" type="date" value="${esc(initialDate)}" required><div class="wb-flow-grid"><div><label for="wbCloseHours">Temps passé (heures)</label><input id="wbCloseHours" type="text" inputmode="decimal" placeholder="Ex. 2,5 = 2 h 30" value="${esc(operation.temps??'')}"></div><div><label for="wbClosePay">Argent perçu (€)</label><input id="wbClosePay" type="text" inputmode="decimal" placeholder="0 pour une intervention non rémunérée" value="${esc(operation.remuneration??'')}"></div></div>`,[{label:'Annuler',value:null},{label:done(operation)?'Enregistrer la clôture':'Confirmer la fin de l’intervention',primary:true,read:d=>{
   const date=d.querySelector('#wbCloseDate').value;if(!date)throw new Error('Indique la date réelle de réalisation.');
   const read=id=>{const value=d.querySelector(id).value.trim().replace(',','.');if(value!==''&&(!/^\d+(\.\d+)?$/.test(value)||!Number.isFinite(Number(value))))throw new Error('Indique des valeurs positives ou zéro.');return value;};
   return {date,temps:read('#wbCloseHours'),remuneration:read('#wbClosePay')};
  }}]);
 }
 async function closeOperation(ref,extra={}){
  const info=await call('operationInfo',ref);const closure=await closureForm({...info,report:extra.report});if(!closure)return null;
  const op=info.operation;const expectedClosure=info.ref.vehicleId?{date:op.date||'',temps:op.temps??null,remuneration:op.remuneration??null,status:status(op)}:null;
  const result=await call('complete',{...ref,...extra,closure,expectedClosure});global.dispatchEvent(new CustomEvent('wb-workflow-updated',{detail:result}));return result;
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
