/* WheelerBrothers 56.5 — préparation volontaire, relecture obligatoire, nouveau rapport uniquement. */
(function(){
  'use strict';
  const R=window.WBReportAIReview,C=window.WBReportAICore,H=window.WBReportAIHost,CFG=window.WB_REPORT_AI_CONFIG;
  if(!R || !C || !H || !CFG?.enabled)return;
  const KEY='wb_ai_pending_v1';
  const LIMIT=Math.min(C.MAX_IMAGES,CFG.maxImages||100);
  const id=(prefix,n)=>prefix+Array.from(crypto.getRandomValues(new Uint8Array(n))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let assets=[],documents=[],plan=null,jobId='',busy=false,requestInput=null,usage=null,vehicleKm=null,vehiclePlate='',workflowRef=null,workflowOptions=[],vehicleRecords=[],rejectedFiles=new Map();
  const dialog=document.createElement('dialog');dialog.className='wb-ai-dialog no-print';dialog.id='wbAiDialog';
  dialog.setAttribute('aria-labelledby','aiTitle');
  const checks=H.blank().checkpoints;
  dialog.innerHTML=`<header class="wb-ai-head"><h2 id="aiTitle">Créer un rapport avec l’IA</h2><button type="button" class="btn ghost" id="aiClose" aria-label="Fermer">✕</button></header>
    <div class="wb-ai-body"><p class="wb-ai-notice">Ajoute tes photos et décris les travaux. L’IA propose un classement ; tu le relis avant de créer un <strong>nouveau</strong> rapport. Aucun ancien rapport n’est remplacé. Le rattachement reste facultatif ; la création ne termine pas l’intervention et ne partage pas le rapport.</p>
    <div id="aiResume" class="wb-ai-resume" hidden>Une préparation précédente est disponible. Si le transfert a été interrompu avant l'analyse, sélectionne de nouveau les mêmes fichiers : ceux déjà envoyés ne seront pas renvoyés.<div class="wb-ai-actions"><button class="btn" id="aiResumeBtn" type="button">Reprendre la préparation / relecture</button><button class="btn ghost" id="aiForget" type="button">Abandonner ce brouillon</button></div></div>
    <section id="aiInput">
      <div class="wb-ai-grid">
        <div><label for="aiVehicleSelect">Véhicule du Carnet d’atelier (facultatif)</label><select id="aiVehicleSelect"><option value="">Saisie manuelle d’une immatriculation</option></select><button type="button" class="btn ghost" id="aiReloadVehicles">Actualiser la liste</button><p class="wb-ai-muted" id="aiVehicleListStatus">Sélectionne une fiche ou saisis une plaque ci-dessous.</p></div>
        <div><label for="aiPlate">Immatriculation</label><div class="wb-ai-plate"><input id="aiPlate" maxlength="160" autocapitalize="characters" placeholder="FL-656-AC"><button class="btn ghost" type="button" id="aiVerify">Vérifier</button></div><label class="wb-ai-check wb-ai-other"><input type="checkbox" id="aiPlateOther"><span>Autre format</span></label><p id="aiVehicleStatus" class="wb-ai-muted" role="status"></p></div>
        <div><label for="aiKm">Kilométrage</label><input id="aiKm" inputmode="numeric" maxlength="160" placeholder="65 000"></div>
        <div><label for="aiBrand">Marque</label><input id="aiBrand" maxlength="160" placeholder="Audi"></div>
        <div><label for="aiModel">Modèle</label><input id="aiModel" maxlength="160" placeholder="RS3"></div>
        <div><label for="aiDate">Date d’intervention</label><input id="aiDate" type="date"></div>
      </div>
      <div class="wb-ai-grid"><div><label for="aiEngine">Motorisation</label><input id="aiEngine" maxlength="160"></div><div><label for="aiReg">1ère mise en circulation</label><input id="aiReg" placeholder="JJ/MM/AAAA" maxlength="160"></div></div>
      <p id="aiMileageStatus" class="wb-ai-muted">La recherche de fiche se déclenche uniquement avec « Vérifier ».</p>
      <div class="wb-flow-panel"><label for="aiLinkedOperation">Intervention liée (facultatif)</label><select id="aiLinkedOperation"><option value="">Aucune — rapport indépendant</option></select><p id="aiWorkflowHint" class="wb-flow-muted">Clique sur « Vérifier » pour afficher les interventions du véhicule. Les opérations possédant déjà un rapport sont grisées.</p></div><label for="aiNotes">Travaux effectués, pièces et précisions *</label><textarea id="aiNotes" maxlength="12000" placeholder="Ex. : vidange moteur et remplacement du filtre à huile ; nettoyage du filtre à air réutilisable. Préciser les côtés ou les références si nécessaire."></textarea>
      <h3>Photos de l’intervention</h3><p class="wb-ai-muted">Jusqu’à ${LIMIT} photos originales, sans compression ni redimensionnement. Envoi privé sur Storage, analyse IA en plusieurs lots automatiques. Les formats HEIC/HEIF sont conservés à l’identique et nécessitent une copie PNG sans perte pour l’analyse. Les formats ou photos incompatibles sont signalés avant le lancement.</p>
      <label class="filebtn btn" for="aiFiles">Ajouter des photos</label><input id="aiFiles" type="file" accept="image/*" multiple>
      <p id="aiCount" class="wb-ai-muted">Aucune photo sélectionnée.</p><p id="aiUploadProgress" class="wb-ai-muted" role="status" aria-live="polite"></p><div id="aiPhotoErrors" class="wb-ai-problems" hidden></div><label class="wb-ai-check" id="aiPartialLabel" hidden><input type="checkbox" id="aiPartialConfirm"><span>Je confirme analyser seulement les photos acceptées malgré les photos refusées ci-dessus.</span></label><div id="aiGallery" class="wb-ai-gallery"></div>
      <h3>Factures PDF</h3><p class="wb-ai-muted">Les PDF sont analysés pour relever les références des pièces et toutes leurs pages sont ajoutées en fin de rapport, dans l’ordre de sélection. Maximum 3 PDF, 8 Mio chacun et 20 pages au total. Vérifie les références avant validation.</p>
      <label class="filebtn btn" for="aiPdfFiles">Ajouter des factures PDF</label><input id="aiPdfFiles" type="file" accept="application/pdf,.pdf" multiple><div id="aiPdfList" class="wb-ai-muted"></div>
      <details><summary>Contrôles confirmés et recommandations (facultatif)</summary><p class="wb-ai-muted">Cocher seulement les contrôles réellement effectués. L’IA ne coche rien automatiquement.</p>
      ${checks.map((cp,i)=>`<label class="wb-ai-check"><input type="checkbox" id="aiCp${i}"><span>${esc(cp.label)}</span></label>`).join('')}
      <label for="aiClosing">Recommandations / prochaine révision</label><textarea id="aiClosing" maxlength="2000" placeholder="Reprendre uniquement les recommandations et échéances que tu confirmes."></textarea></details>
      <label class="wb-ai-check"><input type="checkbox" id="aiConsent"><span>J’autorise l’envoi de ces photos, factures PDF et notes à OpenAI pour préparer ce rapport. Plusieurs appels API facturables peuvent être nécessaires (analyse des photos puis une synthèse globale texte) lorsque je cliquerai sur « Préparer le rapport ».</span></label>
      <div class="wb-ai-actions"><button type="button" class="btn primary" id="aiGenerate">Préparer le rapport</button></div>
    </section>
    <div id="aiStatus" class="wb-ai-status" role="status" aria-live="polite"></div>
    <div class="wb-ai-actions" id="aiRetryArea" hidden><button class="btn" type="button" id="aiRetry">Réessayer (nouvel appel API)</button><button class="btn ghost" type="button" id="aiRefresh">Vérifier le résultat existant</button></div>
    <div class="wb-ai-actions"><button type="button" class="btn ghost" id="aiDiscard" hidden>Abandonner ce brouillon</button></div><section id="aiReview" hidden><h3>Relire le classement</h3><p class="wb-ai-muted">Corrige les textes, fusionne ou supprime les doublons et ordonne les prestations. Pour les photos : choisis leur affectation, utilise les flèches ou saisis directement leur position dans la galerie. « Retirer du rapport » reste réversible, sans supprimer le fichier original.</p>
      <p id="aiReviewCount" class="wb-ai-muted"></p><div class="wb-ai-actions"><button type="button" class="btn ghost" id="aiConsolidate">Consolider les textes et doublons</button><button type="button" class="btn ghost" id="aiUndoReview" disabled>Annuler la dernière action</button><button type="button" class="btn ghost" id="aiExportReview">Exporter la relecture</button><label class="filebtn btn ghost" for="aiImportReview">Restaurer une relecture</label><input type="file" id="aiImportReview" accept="application/json,.json"></div><p class="wb-ai-muted">La consolidation utilise un appel texte facturable, sans réanalyser les photos. Le classement manuel est conservé ; une copie permet d’annuler.</p>
      <label for="aiSummary">Résumé global des travaux</label><textarea id="aiSummary" maxlength="1600"></textarea>
      <button type="button" class="btn ghost" id="aiSummaryFromTitles">Recomposer le résumé à partir des titres (sans IA)</button>
      <div id="aiSections"></div><button type="button" class="btn ghost" id="aiAddSection">+ Ajouter une prestation</button>
      <section class="wb-ai-bay-panel" id="aiBayPanel"><h4>Entretien baie moteur — bloc séparé</h4><p class="wb-ai-muted">Ce bloc avant/après n’est pas une prestation du sommaire. Affecte les photos à « Baie moteur : avant » ou « après ». Si le stade est incertain, confirme-le : le nom du fichier ne suffit pas.</p><label class="wb-ai-check"><input type="checkbox" id="aiBayExpected"><span>Entretien baie moteur effectué — au moins une photo nécessaire.</span></label></section><label class="filebtn btn ghost" for="aiExtraFiles">Ajouter des photos manquantes (sans nouvel appel IA)</label><input id="aiExtraFiles" type="file" accept="image/*" multiple><div id="aiReviewGallery" class="wb-ai-review-groups"></div><p id="aiPhotoOrderStatus" class="wb-ai-sr-only" role="status" aria-live="polite"></p>
      <div id="aiInvoiceReview" class="wb-ai-muted"></div><div id="aiWarnings" class="wb-ai-warnings"></div><div id="aiProblems" class="wb-ai-problems" role="status"></div><p id="aiUsage" class="wb-ai-usage"></p>
      <p id="aiReadyStatus" class="wb-ai-muted" role="status"></p><label class="wb-ai-check"><input type="checkbox" id="aiApprove"><span>J’ai relu les informations et le classement des photos. Créer le rapport ; si une intervention est sélectionnée, y rattacher le document sans la terminer ni le partager.</span></label>
      <div class="wb-ai-actions"><button class="btn primary" type="button" id="aiApply" disabled>Créer le rapport dans l’éditeur</button></div>
    </section></div>`;
  document.body.appendChild(dialog);
  const $=name=>dialog.querySelector('#'+name);
  function status(message,kind=''){ $('aiStatus').textContent=message;$('aiStatus').dataset.kind=kind; }
  function remember(){
    $('aiDiscard').hidden=!jobId;
    try{
      const old=remembered();
      const current=assets.map(a=>({id:a.id,name:a.name,size:a.sourceSize||a.original?.size||0,lastModified:a.lastModified||0,
        ext:a.ext,originalExt:a.originalExt,uploaded:Boolean(a.uploaded||a.url),originalUploaded:Boolean(a.originalUploaded)}));
      const oldEntries=old?.jobId===jobId&&old.uploadPending&&Array.isArray(old.manifest)?old.manifest:[];
      const currentById=new Map(current.map(a=>[a.id,a]));
      // On a resumed iPhone session, keep metadata for all the 85 original
      // selections even when the user has only reselected the first 10.
      const manifest=oldEntries.length>current.length
        ? oldEntries.map(a=>currentById.get(a.id)||a)
        : current;
      const docs=documents.map(d=>({id:d.id,name:d.name,size:d.sourceSize||d.blob?.size||0,lastModified:d.lastModified||0,uploaded:Boolean(d.uploaded),pages:(d.pages||[]).map(p=>({id:p.id}))}));
      const oldDocs=old?.jobId===jobId&&old.uploadPending&&Array.isArray(old.docManifest)?old.docManifest:[];
      const docsById=new Map(docs.map(d=>[d.id,d]));
      const docManifest=oldDocs.length>docs.length?oldDocs.map(d=>docsById.get(d.id)||d):docs;
      const data={...(old?.jobId===jobId?old:{}),jobId,workflowRef,
        uploadPending:!requestInput,manifest,docManifest};
      if(!requestInput){data.meta=metaFromForm();data.notes=$('aiNotes').value;}
      localStorage.setItem(KEY,JSON.stringify(data));
    }catch(e){console.warn('Reprise locale indisponible, garde cette page ouverte.',e);}
  }
  function remembered(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){return null;}}
  function forget(){try{localStorage.removeItem(KEY);}catch(e){}$('aiResume').hidden=true;}
  function setBusy(value){
    busy=value;
    ['aiClose','aiGenerate','aiFiles','aiPdfFiles','aiVerify','aiRetry','aiRefresh','aiResumeBtn','aiForget','aiDiscard','aiApply','aiVehicleSelect','aiReloadVehicles'].forEach(k=>{$(k).disabled=value;});
    $('aiInput').querySelectorAll('input,textarea').forEach(el=>el.disabled=value);
    $('aiReview').querySelectorAll('input,textarea,select').forEach(el=>el.disabled=value);
    $('aiReview').querySelectorAll('button').forEach(el=>el.disabled=value);
    $('aiReview').querySelectorAll('[data-boundary]').forEach(el=>el.disabled=value||el.dataset.boundary==='true');
    if(!value)updateProblems();
  }
  async function call(action,extra={}){
    await H.ready;
    if(typeof window.firebase?.app!=='function' || typeof firebase.app().functions!=='function')throw new Error('Le module Firebase Functions n’a pas été chargé. Recharge la page avec une connexion active.');
    const fn=firebase.app().functions(CFG.region).httpsCallable(CFG.functionName,{timeout:510000});
    try{return (await fn({action,...extra})).data;}
    catch(e){
      const code=e.code||'';
      if(code.includes('not-found') || code.includes('internal') || code.includes('unavailable'))throw new Error('Service IA inaccessible. Vérifie le déploiement de la fonction wbReportAI et sa région. Aucun résultat n’a été appliqué.');
      throw new Error(e.message||'Connexion au service IA impossible.');
    }
  }
  function normalizePlate(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  function checkKm(){
    const value=Number(String($('aiKm').value).replace(/[^0-9]/g,''));
    const mismatch=vehicleKm!=null && normalizePlate($('aiPlate').value)===vehiclePlate && $('aiKm').value.trim() && value<vehicleKm;
    $('aiMileageStatus').textContent=mismatch?`⚠ Kilométrage inférieur au dernier connu (${vehicleKm.toLocaleString('fr-FR')} km). Vérifie la saisie.`:vehicleKm!=null && normalizePlate($('aiPlate').value)===vehiclePlate?`Dernier kilométrage connu : ${vehicleKm.toLocaleString('fr-FR')} km.`:'La recherche de fiche se déclenche uniquement avec « Vérifier ».';
    $('aiMileageStatus').classList.toggle('wb-ai-warning',Boolean(mismatch));
  }
  $('aiPlate').addEventListener('input',()=>{$('aiVehicleSelect').value='';workflowRef=null;workflowOptions=[];renderWorkflowOptions();WBVehicleInput.formatPlate($('aiPlate'),$('aiPlateOther').checked);vehicleKm=null;vehiclePlate='';$('aiVehicleStatus').textContent='';checkKm();});
  $('aiKm').addEventListener('input',()=>{WBVehicleInput.formatKm($('aiKm'));checkKm();});
  $('aiPlateOther').addEventListener('change',()=>{$('aiPlate').dispatchEvent(new Event('input',{bubbles:true}));});
  $('aiVerify').onclick=async()=>{
    const key=normalizePlate($('aiPlate').value);if(!key){$('aiVehicleStatus').textContent='Saisis une plaque.';return;}
    const previous=Object.fromEntries(['Brand','Model','Engine','Reg'].map(k=>[k,$('ai'+k).value]));
    $('aiVerify').disabled=true;$('aiVehicleStatus').textContent='Recherche dans le carnet Atelier…';
    try{
      const result=await H.lookupVehicle(key);
      if(normalizePlate($('aiPlate').value)!==key)return;
      if(result.matches!==1){vehicleKm=null;vehiclePlate='';$('aiVehicleStatus').textContent=result.matches?'Plusieurs fiches correspondent : aucun remplissage.':'Aucune fiche trouvée.';checkKm();return;}
      const info=result.info;
      const fields=[['Brand','brand'],['Model','model'],['Engine','engine'],['Reg','reg']];
      const conflicts=fields.filter(([k,v])=>info[v] && previous[k] && previous[k]!==info[v]);
      const replace=conflicts.length?confirm('Remplacer les champs déjà renseignés par ceux du carnet ?\n'+conflicts.map(([k,v])=>k+' : '+info[v]).join('\n')):false;
      for(const [k,v] of fields)if(info[v] && (!previous[k]||replace) && $('ai'+k).value===previous[k])$('ai'+k).value=info[v];
      vehicleKm=result.km?.km??null;vehiclePlate=key;checkKm();const choices=await WBWorkflow.call('list');workflowOptions=choices.vehicles.filter(v=>v.id===result.vehicleId).flatMap(v=>v.operations.map(o=>({...o,vehicleId:v.id})));workflowOptions.push(...(choices.pendingPlanning||[]).filter(x=>String(x.vehicle.plate||'').toUpperCase().replace(/[^A-Z0-9]/g,'')===key).map(x=>({...x.operation,vehicleId:x.vehicle.id})));renderWorkflowOptions();
      $('aiVehicleStatus').textContent='Fiche trouvée. Les champs disponibles ont été complétés.'+(info.inferred?' Vérifie la marque et le modèle déduits.':'');
    }catch(e){$('aiVehicleStatus').textContent='Recherche indisponible : '+e.message;}
    finally{$('aiVerify').disabled=false;}
  };
  async function loadVehicles(){
    if(busy)return;
    const select=$('aiVehicleSelect'),current=select.value;
    $('aiVehicleListStatus').textContent='Chargement des véhicules depuis le Carnet d’atelier…';
    $('aiReloadVehicles').disabled=true;
    try{
      vehicleRecords=await H.listVehicles();
      select.replaceChildren();
      const empty=document.createElement('option');empty.value='';empty.textContent='Saisie manuelle d’une immatriculation';select.append(empty);
      vehicleRecords.forEach(v=>{const option=document.createElement('option');option.value=v.id;option.textContent=[v.brand,v.label,v.plate||'Sans immatriculation',v.owner].filter(Boolean).join(' — ');select.append(option);});
      select.value=vehicleRecords.some(v=>v.id===current)?current:'';
      $('aiVehicleListStatus').textContent=vehicleRecords.length+' véhicule(s) disponible(s).';
    }catch(e){$('aiVehicleListStatus').textContent='Liste indisponible : '+e.message+' — la saisie manuelle reste possible.';}
    finally{$('aiReloadVehicles').disabled=false;}
  }
  $('aiReloadVehicles').onclick=loadVehicles;
  $('aiVehicleSelect').onchange=async()=>{
    const v=vehicleRecords.find(v=>v.id===$('aiVehicleSelect').value);if(!v)return;
    const info=v.info||{},pairs=[['aiPlate',v.plate],['aiBrand',info.brand],['aiModel',info.model],['aiEngine',info.engine],['aiReg',info.reg]];
    const different=pairs.filter(([k,value])=>value&&$(k).value.trim()&&(k==='aiPlate'?normalizePlate($(k).value)!==normalizePlate(value):$(k).value.trim()!==value));
    if(different.length && !confirm('Cette sélection remplacerait des informations déjà saisies ('+different.map(([k])=>k.replace('ai','')).join(', ')+'). Continuer ?')){$('aiVehicleSelect').value='';return;}
    pairs.forEach(([k,value])=>{if(value)$(k).value=value;});
    WBVehicleInput.loadPlate($('aiPlate'),$('aiPlateOther'),v.plate||'');
    workflowRef=null;workflowOptions=[];renderWorkflowOptions();
    if(v.plate){await $('aiVerify').click();}
    else $('aiVehicleStatus').textContent='Fiche sans immatriculation : renseigne une plaque pour associer les opérations.';
  };
  function renderDocuments(){
    $('aiPdfList').innerHTML=documents.map(d=>`<div class="wb-ai-document">📄 ${esc(d.name)} — ${d.pages.length} page(s) <button type="button" class="btn ghost" data-pdf-remove="${d.id}">Retirer</button></div>`).join('');
    $('aiPdfList').querySelectorAll('[data-pdf-remove]').forEach(b=>b.onclick=()=>{if(busy||jobId)return;documents=documents.filter(d=>d.id!==b.dataset.pdfRemove);renderDocuments();});
  }
  $('aiPdfFiles').addEventListener('change',async e=>{
    const files=[...e.target.files];e.target.value='';if(busy||(jobId&&requestInput)||(!jobId&&remembered()?.jobId&&!remembered()?.uploadPending))return;setBusy(true);const errors=[];
    const pending=remembered();const recovering=Boolean(pending?.uploadPending&&pending?.jobId&&pending.docManifest?.length);
    if(recovering&&!jobId){jobId=pending.jobId;setMeta(pending.meta||{});$('aiNotes').value=pending.notes||'';}
    try{for(const f of files){
      try{
        if(documents.length>=3)throw new Error('Maximum 3 factures PDF');
        if(f.size>8*1024*1024||f.size<8||!(/\.pdf$/i.test(f.name)))throw new Error('PDF invalide ou supérieur à 8 Mio');
        const bytes=new Uint8Array(await f.slice(0,5).arrayBuffer());if(String.fromCharCode(...bytes)!=='%PDF-')throw new Error('En-tête PDF invalide');
        status('Conversion locale des pages de '+f.name+'…');
        const images=await H.pdfPages(f,1.35);
        if(!images.length||images.length+documents.reduce((n,d)=>n+d.pages.length,0)>20)throw new Error('Maximum 20 pages de factures au total');
        const previous=recovering?pending.docManifest.find(d=>d.name===f.name.slice(0,160)&&d.size===f.size&&d.lastModified===f.lastModified&&!documents.some(x=>x.id===d.id)):null;
        if(recovering&&!previous)throw new Error('Facture différente du transfert interrompu.');
        if(previous && previous.pages.length!==images.length)throw new Error('Le nombre de pages a changé : la facture ne correspond plus au brouillon.');
        const pages=[];
        for(let i=0;i<images.length;i++){
          const blob=await (await fetch(images[i])).blob();if(blob.size>2*1024*1024)throw new Error('Page PDF trop volumineuse');
          pages.push({id:previous?.pages[i]?.id||id('a',12),blob});
        }
        documents.push({id:previous?.id||id('d',12),name:f.name.slice(0,160),sourceSize:f.size,lastModified:f.lastModified,uploaded:Boolean(previous?.uploaded),blob:f,pages});
        if(jobId)remember();
      }catch(err){errors.push(f.name+' : '+err.message);}
    }}finally{
      setBusy(false);renderDocuments();
      const pending=remembered();const missing=pending?.uploadPending?(pending.docManifest?.length||0)-documents.length:0;
      status(errors.length?errors.join('\n'):(missing>0?`${missing} facture(s) du transfert précédent restent à resélectionner.`:'Factures préparées localement. Elles seront analysées avec les photos.'),errors.length?'error':'');
    }
  });
  const MAX_IMAGE_BYTES=20*1024*1024;
  const contentType={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
  async function preparePhoto(file){
    const type=String(file.type||'').toLowerCase(),name=String(file.name||'photo');
    const extension=name.split('.').pop().toLowerCase();
    const ext=(type==='image/jpeg'||['jpg','jpeg'].includes(extension))?'jpg':
      (type==='image/png'||extension==='png')?'png':
      (type==='image/webp'||extension==='webp')?'webp':null;
    if(ext){
      if(file.size>MAX_IMAGE_BYTES)throw new Error('Original supérieur à 20 Mio : impossible à analyser en un seul appel IA.');
      return {blob:file,original:file,ext,originalExt:ext};
    }
    // An HEIC original is retained byte-for-byte. Only a distinct, lossless
    // PNG rendering is sent to the model and embedded in the printable report.
    if(!(type.includes('heic')||type.includes('heif')||['heic','heif'].includes(extension)))
      throw new Error('Format non accepté. Utilise JPEG, PNG, WebP ou HEIC/HEIF.');
    let bitmap,url;
    try{
      try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}
      catch{
        url=URL.createObjectURL(file);
        bitmap=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Ce navigateur ne décode pas HEIC. Exporte un PNG sans perte.'));img.src=url;});
      }
      const w=bitmap.width||bitmap.naturalWidth,h=bitmap.height||bitmap.naturalHeight;
      if(!w||!h||w*h>60000000)throw new Error('Dimensions trop importantes pour la conversion PNG sans perte.');
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Conversion PNG impossible sur cet appareil.');
      ctx.drawImage(bitmap,0,0);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      canvas.width=canvas.height=1;
      if(!blob||blob.type!=='image/png'||blob.size>MAX_IMAGE_BYTES)throw new Error('PNG sans perte supérieur à 20 Mio. Cette photo n’a pas été ajoutée ; exporte-la en PNG compatible.');
      return {blob,original:file,ext:'png',originalExt:extension};
    }finally{if(bitmap?.close)bitmap.close();if(url)URL.revokeObjectURL(url);}
  }
  function renderPhotoErrors(){
    const names=[...rejectedFiles.values()];
    $('aiPhotoErrors').hidden=!names.length;
    $('aiPhotoErrors').textContent=names.length?'Photos refusées ('+names.length+') :\n'+names.join('\n')+'\nRéessaie de les ajouter. Aucune n’est ignorée silencieusement.':'';
    $('aiPartialLabel').hidden=!names.length;
    if(!names.length)$('aiPartialConfirm').checked=false;
  }
  function renderInputPhotos(){
    const total=assets.reduce((n,a)=>n+(a.blob?.size||0),0);
    const remaining=remembered()?.uploadPending&&remembered()?.manifest?.length>assets.length?` — ${remembered().manifest.length-assets.length} fichier(s) à resélectionner pour reprendre`:'';
    $('aiCount').textContent=`${assets.length} / ${LIMIT} photos — ${(total/1024/1024).toFixed(1)} Mio à transférer (fichiers originaux, ou PNG sans perte pour HEIC)${remaining}.`;
    $('aiGallery').innerHTML=assets.map(a=>`<div class="wb-ai-tile"><img src="${esc(a.preview||a.url)}" alt="${esc(a.name)}" loading="lazy"><div class="wb-ai-name">${esc(a.name)}</div><button class="btn ghost" type="button" data-remove="${a.id}">Retirer</button></div>`).join('');
    renderPhotoErrors();
    $('aiGallery').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{
      if(busy||jobId)return;
      const a=assets.find(a=>a.id===b.dataset.remove);if(a?.preview)URL.revokeObjectURL(a.preview);
      assets=assets.filter(a=>a.id!==b.dataset.remove);renderInputPhotos();
    });
  }
  $('aiFiles').addEventListener('change',async e=>{
    if(busy||(jobId&&requestInput)||(!jobId&&remembered()?.jobId&&!remembered()?.uploadPending)){
      status('Une analyse existe déjà. Utilise « Reprendre » ou « Abandonner » avant de changer les photos.','error');return;
    }
    const files=[...e.target.files];e.target.value='';setBusy(true);const errors=[];
    const pending=remembered();
    const recovering=Boolean(pending?.jobId&&pending.uploadPending&&Array.isArray(pending.manifest)&&pending.manifest.length);
    if(recovering && !jobId){jobId=pending.jobId;setMeta(pending.meta||{});$('aiNotes').value=pending.notes||'';}
    try{
      for(let i=0;i<files.length;i++){
        if(assets.length>=LIMIT){errors.push('Limite de '+LIMIT+' images atteinte.');break;}
        const f=files[i];status(`Préparation locale de la photo ${i+1} / ${files.length}… Aucun appel IA.`);
        try{
          let existing=null;
          if(recovering){
            const used=new Set(assets.map(a=>a.id));
            existing=pending.manifest.find(a=>!used.has(a.id)&&a.name===f.name.slice(0,200)&&a.size===f.size&&a.lastModified===f.lastModified);
            if(!existing){errors.push('Fichier inattendu : '+f.name+'. Choisis uniquement les photos du transfert interrompu.');continue;}
          }
          const prepared=await preparePhoto(f),blob=prepared.blob;
          if(existing && existing.ext!==prepared.ext)throw new Error('Format différent de la préparation initiale.');
          assets.push({id:existing?.id||id('a',12),name:f.name.slice(0,200),sourceSize:f.size,lastModified:f.lastModified,
            ...prepared,uploaded:Boolean(existing?.uploaded),originalUploaded:Boolean(existing?.originalUploaded),preview:URL.createObjectURL(blob)});
          rejectedFiles.delete(f.name+'-'+f.size);
        }catch(err){const message=f.name+' : '+err.message;errors.push(message);rejectedFiles.set(f.name+'-'+f.size,message);}
      }
      if(recovering){
        const positions=new Map(pending.manifest.map((a,i)=>[a.id,i]));
        assets.sort((a,b)=>(positions.get(a.id)??999)-(positions.get(b.id)??999));
        $('aiGenerate').disabled=false;
        remember();
      }
    }finally{
      setBusy(false);renderInputPhotos();
      const missing=recovering?pending.manifest.length-assets.length:0;
      status(errors.length?errors.join('\n'):(missing?`${assets.length} / ${pending.manifest.length} fichiers retrouvés. Resélectionne les ${missing} autres.`:'Toutes les photos sont prêtes sans compression. Tu peux lancer l’analyse.'),errors.length?'error':'');
    }
  });
  function metaFromForm(){
    const m={};[['plate','Plate'],['km','Km'],['brand','Brand'],['model','Model'],['date','Date'],['engine','Engine'],['reg','Reg'],['closing','Closing']].forEach(([key,suffix])=>m[key]=$('ai'+suffix).value.trim());
    m.plate=WBVehicleInput.formatPlate($('aiPlate'),$('aiPlateOther').checked);m.km=WBVehicleInput.digits(m.km);m.checkpoints=checks.map((_,i)=>$('aiCp'+i).checked);return m;
  }
  function setMeta(m){
    [['plate','Plate'],['km','Km'],['brand','Brand'],['model','Model'],['date','Date'],['engine','Engine'],['reg','Reg'],['closing','Closing']].forEach(([key,suffix])=>$('ai'+suffix).value=m[key]||'');
    WBVehicleInput.loadPlate($('aiPlate'),$('aiPlateOther'),m.plate);
    $('aiKm').value=WBVehicleInput.mileage(m.km);
    checks.forEach((_,i)=>$('aiCp'+i).checked=m.checkpoints?.[i]===true);
  }
  // Three simultaneous uploads: avoids 85 serialized round-trips while keeping
  // iPhone memory/network usage bounded. Progress uses real byte counters.
  // A Storage file is only marked uploaded after its URL is resolved; interrupted
  // transfers can be reselected with their original IDs, with verification.
  async function upload(){
    const space=H.space(), parallel=3;
    const totalFiles=assets.length;
    const bytesOf=a=>a.blob.size+(a.original!==a.blob?a.original.size:0);
    const totalBytes=assets.reduce((n,a)=>n+bytesOf(a),0);
    const progress=new Map(),failures=[];
    let completed=0,nextIndex=0;
    function paint(){
      const sent=Math.min(totalBytes,[...progress.values()].reduce((n,x)=>n+x,0));
      const text=`Envoi sécurisé : ${(sent/1048576).toFixed(1)} / ${(totalBytes/1048576).toFixed(1)} Mio — ${completed} / ${totalFiles} photos terminées`;
      $('aiUploadProgress').textContent=text;
      status(text+'\nAucun appel OpenAI à cette étape.');
    }
    async function transfer(ref,blob,contentType,key){
      const task=ref.put(blob,{contentType,cacheControl:'private,max-age=3600'});
      progress.set(key,0);
      task.on('state_changed',snap=>{progress.set(key,snap.bytesTransferred||0);paint();});
      await task;
      progress.set(key,blob.size);paint();
    }
    async function sendPhoto(a){
      const key=a.id+':main',originalKey=a.id+':original';
      const raw=a.original!==a.blob;
      const originalPath=`spaces/${space}/reports/${jobId}/ai-original-${a.id}.${a.originalExt}`;
      const path=`spaces/${space}/reports/${jobId}/ai-${a.id}.${a.ext}`;
      const ref=H.storage().ref().child(path);
      if(raw){
        if(a.originalUploaded){
          try{await H.storage().ref().child(originalPath).getMetadata();progress.set(originalKey,a.original.size);}
          catch{a.originalUploaded=false;}
        }
        if(!a.originalUploaded){await transfer(H.storage().ref().child(originalPath),a.original,a.original.type||'application/octet-stream',originalKey);a.originalUploaded=true;remember();}
      }
      if(a.uploaded&&!a.url){
        try{a.url=await ref.getDownloadURL();progress.set(key,a.blob.size);}catch{a.uploaded=false;}
      }
      if(!a.url){
        await transfer(ref,a.blob,contentType[a.ext],key);
        a.url=await ref.getDownloadURL();a.uploaded=true;
      }
      progress.set(key,a.blob.size);completed++;remember();paint();
    }
    async function worker(){
      while(nextIndex<assets.length){
        const index=nextIndex++,a=assets[index];
        try{await sendPhoto(a);}catch(error){failures.push(a.name+' : '+(error?.message||'échec réseau'));remember();}
      }
    }
    paint();await Promise.all(Array.from({length:Math.min(parallel,assets.length)},()=>worker()));
    if(failures.length)throw new Error(failures.length+' photo(s) non transmises :\n'+failures.join('\n')+'\nLes photos déjà envoyées seront conservées. Relance « Préparer le rapport » après vérification de ta connexion, ou resélectionne les mêmes fichiers si la page a été fermée.');
    $('aiUploadProgress').textContent=`${totalFiles} / ${totalFiles} photos envoyées — ${(totalBytes/1048576).toFixed(1)} Mio. Prêt pour l'analyse.`;
    for(const d of documents){
      const docRef=H.storage().ref().child(`spaces/${space}/reports/${jobId}/ai-doc-${d.id}.pdf`);
      if(d.uploaded){try{await docRef.getMetadata();}catch{d.uploaded=false;}}
      if(!d.uploaded){status('Envoi sécurisé de la facture '+d.name+'…');await docRef.put(d.blob,{contentType:'application/pdf'});d.uploaded=true;remember();}
      for(const page of d.pages){if(page.url)continue;const ref=H.storage().ref().child(`spaces/${space}/reports/${jobId}/ai-inv-${page.id}.jpg`);try{page.url=await ref.getDownloadURL();}catch{await ref.put(page.blob,{contentType:'image/jpeg'});page.url=await ref.getDownloadURL();}}
    }
  }
  function entryValue(p){return R.galleryKey(p);}
  function options(){
    let html='<option value="unassigned">À classer</option><option value="excluded">Ne pas inclure (choix manuel)</option>';
    const labels={overview:'Couverture : véhicule',products:'Sommaire : produits/pièces',labelR:'Étiquette entretien : recto',labelV:'Étiquette entretien : verso',baieAvant:'Baie moteur : avant',baieApres:'Baie moteur : après',baiePending:'Baie moteur : stade à préciser',invoice:'Facture en annexe'};
    Object.entries(labels).forEach(([k,v])=>html+=`<option value="${k}">${v}</option>`);
    plan.sections.forEach((s,i)=>{
      if(s.type==='sym') ['L','R'].forEach(side=>html+=`<option value="section|${s.id}|${side}">${i+1}. ${esc(s.title)} — ${side==='L'?'Gauche':'Droite'}</option>`);
      else html+=`<option value="section|${s.id}|">${i+1}. ${esc(s.title)}</option>`;
    });return html;
  }
  let reviewUndo=null,reviewCharges={};
  function persistReview(){
    if(!plan||!jobId)return;
    try{localStorage.setItem(KEY,JSON.stringify({jobId,workflowRef,review:{plan,undo:reviewUndo,charges:reviewCharges,assets:assets.map(a=>({id:a.id,name:a.name,ext:a.ext})),usage}}));}
    catch(e){status('Le classement reste ouvert, mais sa sauvegarde locale a échoué. Utilise « Exporter la relecture » avant de fermer.','error');}
  }
  function checkpointReview(){reviewUndo=R.clone(plan);$('aiUndoReview').disabled=false;}
  function checkpointText(event){if(!event.target.dataset.editStarted){checkpointReview();event.target.dataset.editStarted='1';}}
  function resetTextCheckpoint(event){delete event.target.dataset.editStarted;}
  function resetApproval(){$('aiApprove').checked=false;updateProblems();persistReview();}
  function photoName(id){return assets.find(a=>a.id===id)?.name||id;}
  function usefulWarnings(){
    return [...new Set((plan.warnings||[]).filter(w=>!/^Photos? (manquantes?|absentes?)\s*:/i.test(w.trim())&&!/^Lot\s+(partiel|\d)/i.test(w.trim())).map(w=>{
      for(const a of assets)w=w.split(a.id).join(a.name||a.id);return w;
    }))];
  }
  function showIssue(issue){
    if(issue.code==='summary'){$('aiSummary').focus();$('aiSummary').scrollIntoView({block:'center'});return;}
    if(issue.photoId){focusReviewPhoto(issue.photoId,'.wb-ai-target');return;}
    if(issue.sectionId){
      const card=[...$('aiSections').querySelectorAll('[data-section]')].find(x=>x.dataset.section===issue.sectionId);
      if(card){card.scrollIntoView({block:'start',behavior:'smooth'});card.classList.add('wb-ai-highlight');setTimeout(()=>card.classList.remove('wb-ai-highlight'),1800);card.querySelector('.ai-stitle')?.focus({preventScroll:true});}return;
    }
    $('aiBayPanel').scrollIntoView({block:'center'});
  }
  function updateProblems(){
    if(!plan){$('aiApply').disabled=true;return;}
    const issues=R.issueList(plan),box=$('aiProblems');box.replaceChildren();box.hidden=!issues.length;
    if(issues.length){
      const title=document.createElement('strong');title.textContent=issues.length+' point(s) à corriger avant de créer le rapport :';box.append(title);
      issues.forEach(issue=>{const b=document.createElement('button');b.type='button';b.className='wb-ai-issue';b.textContent=issue.message+(issue.photoId?' — '+photoName(issue.photoId):'');b.onclick=()=>showIssue(issue);box.append(b);});
      const hint=document.createElement('p');hint.textContent='Touchez un point pour le corriger. Un chapitre en double peut être fusionné ou supprimé ; ses photos sont conservées.';box.append(hint);
    }
    // Keep a real action rather than an unexplained inert disabled button. This
    // never bypasses validation: apply() navigates to the first unresolved issue.
    $('aiApply').disabled=busy;
    $('aiApply').textContent=issues.length?`Corriger ${issues.length} point(s) avant de créer le rapport`:'Créer le rapport dans l’éditeur';
    $('aiReadyStatus').textContent=issues.length?'La création est bloquée uniquement par les points listés ci-dessus.':$('aiApprove').checked?'Prêt : toutes les prestations conservées ont leurs photos.':'Relis le classement puis coche la validation ci-dessous.';
    $('aiReviewCount').textContent=`${assets.length} photo(s) disponibles · ${plan.photos.filter(p=>p.kind!=='excluded').length} conservée(s) · ${plan.photos.filter(p=>p.kind==='excluded').length} retirée(s) · ${plan.sections.length} prestation(s)`;
    $('aiUndoReview').disabled=busy||!reviewUndo;
  }
  function reviewPhotos(target){return R.photosIn(plan,target);}
  function reviewGroups(){
    const groups=[{target:'overview',title:'Couverture — véhicule'},{target:'products',title:'Sommaire — produits / pièces'}];
    plan.sections.forEach((s,i)=>{
      const title=`${i+1}. ${s.title||'Prestation sans titre'}`;
      if(s.type==='sym') ['L','R'].forEach(side=>groups.push({target:`section|${s.id}|${side}`,title:title+' — '+(side==='L'?'Gauche':'Droite')}));
      else groups.push({target:`section|${s.id}|`,title});
    });
    groups.push({target:'labelR',title:'Étiquette d’entretien — recto'},{target:'labelV',title:'Étiquette d’entretien — verso'},
      {target:'baieAvant',title:'Baie moteur — avant (bloc séparé)'},{target:'baieApres',title:'Baie moteur — après (bloc séparé)'},
      {target:'baiePending',title:'Baie moteur — avant / après à préciser'},
      {target:'invoice',title:'Factures en annexe'},{target:'unassigned',title:'Photos à classer'},{target:'excluded',title:'Photos retirées du rapport — restaurables'});
    return groups.map(g=>({...g,photos:reviewPhotos(g.target)})).filter(g=>g.photos.length);
  }
  function focusReviewPhoto(photoId,selector){
    const tile=[...$('aiReviewGallery').querySelectorAll('[data-photo]')].find(el=>el.dataset.photo===photoId);
    const details=tile?.closest('details');if(details)details.open=true;
    const control=tile?.querySelector(selector)||tile?.querySelector('.wb-ai-target');
    control?.focus({preventScroll:true});tile?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function placeReviewPhoto(photoId,position){
    if(busy||!plan)return;
    const before=R.clone(plan);
    try{
      const pos=R.setPosition(plan,photoId,position);reviewUndo=before;
      renderReviewPhotos();resetApproval();focusReviewPhoto(photoId,'.wb-ai-position');
      $('aiPhotoOrderStatus').textContent=`${photoName(photoId)} : position ${pos}.`;
    }catch(e){plan=before;status(e.message,'error');renderReviewPhotos();}
  }
  function moveReviewPhoto(photoId,step){const p=plan?.photos.find(x=>x.id===photoId);if(p){const list=reviewPhotos(entryValue(p));placeReviewPhoto(photoId,list.indexOf(p)+step+1);}}
  function renderReviewPhotos(){
    const opts=options(),assetById=new Map(assets.map(a=>[a.id,a]));
    $('aiReviewGallery').innerHTML=reviewGroups().map(group=>{
      const tiles=group.photos.map((p,i)=>{
        const a=assetById.get(p.id)||{id:p.id,name:p.id,url:''};
        const arrow=(step,boundary)=>`<button type="button" class="btn ghost wb-ai-photo-move" data-step="${step}" data-boundary="${boundary}" title="${step<0?'Déplacer avant':'Déplacer après'}" aria-label="${step<0?'Avancer':'Reculer'} ${esc(a.name)} d’une place"${busy||boundary?' disabled':''}>${step<0?'‹':'›'}</button>`;
        return `<div class="wb-ai-tile" data-photo="${esc(p.id)}" data-unassigned="${['unassigned','baiePending'].includes(p.kind)}">
          <div class="wb-ai-photo-tools">${arrow(-1,i===0)}<label class="wb-ai-position-label">Position<input class="wb-ai-position" type="number" inputmode="numeric" min="1" max="${group.photos.length}" step="1" value="${i+1}" aria-label="Position de ${esc(a.name)} dans cette galerie"><span>/ ${group.photos.length}</span></label>${arrow(1,i===group.photos.length-1)}</div>
          <a href="${esc(a.url||a.preview||'')}" target="_blank" rel="noopener"><img src="${esc(a.preview||a.url||'')}" loading="lazy" alt="${esc(a.name)}"></a>
          <div class="wb-ai-name">${esc(a.name)}</div><select class="wb-ai-target" aria-label="Affectation de ${esc(a.name)}"${busy?' disabled':''}>${opts}</select>
          <div class="wb-ai-reason">${esc(p.reason)}</div><label>Légende (facultative)<textarea class="wb-ai-cap" maxlength="350"${busy?' disabled':''}>${esc(p.caption)}</textarea></label>
          <button type="button" class="btn ghost wb-ai-remove-photo">${p.kind==='excluded'?'Restaurer la photo':'Retirer du rapport'}</button></div>`;
      }).join('');
      if(group.target==='excluded')return `<details class="wb-ai-photo-group wb-ai-removed" data-photo-group="excluded"><summary>${esc(group.title)} (${group.photos.length})</summary><p class="wb-ai-muted">Aucun fichier original n’est supprimé de Storage. Les photos retirées ne seront pas dans le rapport.</p><div class="wb-ai-gallery">${tiles}</div></details>`;
      return `<section class="wb-ai-photo-group" data-photo-group="${esc(group.target)}" aria-label="${esc(group.title)}"><div class="wb-ai-group-head"><h4>${esc(group.title)} (${group.photos.length})</h4>${group.photos.length>1&&group.target!=='invoice'?'<button type="button" class="btn ghost wb-ai-sort-files">Trier par numéro de fichier</button>':''}</div><div class="wb-ai-gallery">${tiles}</div></section>`;
    }).join('');
    $('aiReviewGallery').querySelectorAll('[data-photo]').forEach(tile=>{
      const p=plan.photos.find(p=>p.id===tile.dataset.photo),select=tile.querySelector('.wb-ai-target');select.value=entryValue(p);
      select.onchange=()=>{
        if(busy)return;checkpointReview();R.moveTo(plan,p.id,select.value);renderReviewPhotos();resetApproval();focusReviewPhoto(p.id,'.wb-ai-target');
      };
      tile.querySelectorAll('.wb-ai-photo-move').forEach(b=>b.onclick=()=>moveReviewPhoto(p.id,Number(b.dataset.step)));
      const position=tile.querySelector('.wb-ai-position');position.onchange=()=>placeReviewPhoto(p.id,position.value);
      position.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();position.blur();}};
      tile.querySelector('.wb-ai-cap').onfocus=resetTextCheckpoint;tile.querySelector('.wb-ai-cap').oninput=e=>{checkpointText(e);p.caption=e.target.value;resetApproval();};
      tile.querySelector('.wb-ai-remove-photo').onclick=()=>{
        if(busy)return;checkpointReview();if(p.kind==='excluded')R.restorePhoto(plan,p.id);else R.excludePhoto(plan,p.id);
        renderReviewPhotos();resetApproval();status('Photo '+(p.kind==='excluded'?'retirée du rapport (restaurable en bas de la relecture).':'restaurée.'));
      };
    });
    $('aiReviewGallery').querySelectorAll('.wb-ai-sort-files').forEach(button=>button.onclick=()=>{
      if(busy||!confirm('Remplacer l’ordre de cette galerie par les numéros de fichiers ? Les légendes et les affectations restent inchangées.'))return;
      checkpointReview();R.sortByFilename(plan,assets,button.closest('[data-photo-group]').dataset.photoGroup);renderReviewPhotos();resetApproval();
    });
  }
  function rebuildSummary(){plan.summary=R.summaryFromSections(plan);$('aiSummary').value=plan.summary;}
  function sectionChanged(oldSummary,oldGenerated){if(oldSummary===oldGenerated)rebuildSummary();}
  function refreshReviewStructure(){renderSections();renderReviewPhotos();renderWarnings();updateProblems();}
  function renderSections(){
    $('aiSections').innerHTML=plan.sections.map((s,i)=>`<div class="wb-ai-section" data-section="${esc(s.id)}">
      <div class="wb-ai-section-head"><strong>Prestation ${i+1}</strong><div class="wb-ai-section-tools"><button type="button" class="btn ghost ai-section-up" data-boundary="${i===0}"${i===0?' disabled':''} aria-label="Monter la prestation ${i+1}">↑</button><label>Position<input type="number" class="ai-section-position" min="1" max="${plan.sections.length}" value="${i+1}" inputmode="numeric"></label><button type="button" class="btn ghost ai-section-down" data-boundary="${i===plan.sections.length-1}"${i===plan.sections.length-1?' disabled':''} aria-label="Descendre la prestation ${i+1}">↓</button></div></div>
      <label>Titre<input class="ai-stitle" maxlength="160" value="${esc(s.title)}"></label><label>Références / description<textarea class="ai-sdesc" maxlength="1600" placeholder="Une ligne par produit ou référence : marque, désignation, référence.">${esc(s.description)}</textarea></label>
      <label>Présentation<select class="ai-stype"><option value="normal">Simple</option><option value="sym">Gauche / droite</option></select></label>
      <div class="wb-ai-section-merge"><label>Fusionner cette prestation dans<select class="ai-merge-target"><option value="">Choisir une autre prestation…</option>${plan.sections.filter(t=>t.id!==s.id).map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></label><button type="button" class="btn ghost ai-merge">Fusionner</button></div>
      <div class="wb-ai-actions"><button type="button" class="btn ghost ai-to-bay">Déplacer vers le bloc baie moteur</button><button type="button" class="btn ghost ai-section-delete">Supprimer cette prestation</button></div>
      <p class="wb-ai-muted">${plan.photos.filter(p=>p.kind==='section'&&p.sectionId===s.id).length} photo(s). Supprimer la prestation ne supprime pas ses photos : elles seront à reclasser.</p></div>`).join('');
    $('aiSections').querySelectorAll('[data-section]').forEach(card=>{
      const s=plan.sections.find(s=>s.id===card.dataset.section);card.querySelector('.ai-stype').value=s.type;
      card.querySelector('.ai-stitle').onfocus=resetTextCheckpoint;card.querySelector('.ai-stitle').oninput=e=>{checkpointText(e);s.title=e.target.value;renderReviewPhotos();renderWarnings();resetApproval();};
      card.querySelector('.ai-sdesc').onfocus=resetTextCheckpoint;card.querySelector('.ai-sdesc').oninput=e=>{checkpointText(e);s.description=e.target.value;resetApproval();};
      card.querySelector('.ai-stype').onchange=e=>{
        checkpointReview();s.type=e.target.value;plan.photos.filter(p=>p.kind==='section'&&p.sectionId===s.id).forEach(p=>{p.side='';if(s.type==='sym'){p.kind='unassigned';p.sectionId='';p.reason='Choisir le côté gauche ou droit.';}});refreshReviewStructure();resetApproval();
      };
      const place=pos=>{if(busy)return;const before=R.clone(plan);try{R.moveSection(plan,s.id,pos);reviewUndo=before;refreshReviewStructure();resetApproval();showIssue({sectionId:s.id});}catch(e){status(e.message,'error');renderSections();}};
      card.querySelector('.ai-section-up').onclick=()=>place(plan.sections.indexOf(s));
      card.querySelector('.ai-section-down').onclick=()=>place(plan.sections.indexOf(s)+2);
      card.querySelector('.ai-section-position').onchange=e=>place(e.target.value);
      card.querySelector('.ai-section-delete').onclick=()=>{
        if(busy||!confirm('Supprimer « '+s.title+' » de la proposition ? Ses photos seront conservées dans « À classer ».'))return;
        const old=plan.summary,generated=R.summaryFromSections(plan);checkpointReview();R.removeSection(plan,s.id);sectionChanged(old,generated);refreshReviewStructure();resetApproval();
      };
      card.querySelector('.ai-merge').onclick=()=>{
        if(busy)return;const target=card.querySelector('.ai-merge-target').value;
        if(!target){status('Choisis la prestation qui recevra les photos.','error');return;}
        if(!confirm('Fusionner « '+s.title+' » dans « '+plan.sections.find(x=>x.id===target).title+' » ? Les photos et leurs légendes seront conservées.'))return;
        const before=R.clone(plan),old=plan.summary,generated=R.summaryFromSections(plan);
        try{R.mergeSections(plan,s.id,target);reviewUndo=before;sectionChanged(old,generated);refreshReviewStructure();resetApproval();showIssue({sectionId:target});}
        catch(e){plan=before;status(e.message,'error');}
      };
      card.querySelector('.ai-to-bay').onclick=()=>{
        if(busy||!confirm('Déplacer cette prestation dans le bloc baie moteur, hors du sommaire ? Choisis ensuite Avant ou Après pour chaque photo ; aucun stade ne sera deviné.'))return;
        checkpointReview();R.convertEngineBay(plan,s.id);refreshReviewStructure();resetApproval();$('aiBayPanel').scrollIntoView({block:'center'});
      };
    });
    $('aiBayExpected').checked=!!plan.engineBayExpected;
  }
  function renderWarnings(){
    const warnings=usefulWarnings();
    const duplicates=R.duplicateHints(plan).map(group=>'Doublon possible : '+group.map(s=>s.title).join(' / ')+'. Utilise « Fusionner » pour les réunir.');
    const bay=plan.sections.filter(s=>R.isEngineBayTitle(s.title)).map(s=>'« '+s.title+' » doit être déplacée vers le bloc baie moteur avec le bouton de sa prestation.');
    $('aiWarnings').textContent=[...duplicates,...bay,...warnings].length?'Points à vérifier (non imprimés) :\n'+[...duplicates,...bay,...warnings].join('\n'):'';
    const values=Object.values(reviewCharges);const input=(usage?.inputTokens||0)+values.reduce((n,x)=>n+(x.inputTokens||0),0),output=(usage?.outputTokens||0)+values.reduce((n,x)=>n+(x.outputTokens||0),0),cost=(Number(usage?.estimatedUsd)||0)+values.reduce((n,x)=>n+(Number(x.estimatedUsd)||0),0);
    $('aiUsage').textContent=usage?`Utilisation remontée par l’API (photos et synthèse) : ${input} tokens reçus, ${output} générés (raisonnement inclus). Coût indicatif : ${cost.toFixed(3)} $ — hors Firebase/taxes, tarifs ${usage.pricingDate}, pas une facture.`:'';
  }
  function renderReview(){
    $('aiInput').hidden=true;$('aiReview').hidden=false;$('aiResume').hidden=true;$('aiRetryArea').hidden=true;
    $('aiSummary').value=plan.summary;
    refreshReviewStructure();
    $('aiInvoiceReview').textContent=documents.length?'Factures jointes automatiquement en fin de rapport : '+documents.map(d=>d.name+' ('+d.pages.length+' pages)').join(' ; '):'';
    resetApproval();
  }
  async function consolidateReview(){
    if(busy||!plan)return;
    if(!confirm('Consolider les textes et regrouper les doublons ? Un appel API TEXTE sera facturé. Aucune photo ne sera renvoyée ni réanalysée. Les affectations sont conservées, sauf regroupement des doublons et déplacement vers le bloc baie moteur. L’ordre manuel et les légendes restent conservés. Une copie permet d’annuler.'))return;
    const previous=R.clone(plan);setBusy(true);status('Synthèse globale des textes… Les photos ne sont pas réanalysées.');
    try{
      const result=await call('consolidateReview',{jobId,plan:previous,assets:assets.map(a=>({id:a.id,name:a.name,ext:a.ext||'jpg'})),consent:true,retry:true});
      if(result.usage&&result.usageId)reviewCharges[result.usageId]=result.usage;
      if(result.status==='running'){status('Synthèse encore en cours. Tes corrections restent conservées. Utilise de nouveau le bouton pour récupérer le résultat.');return;}
      if(result.status!=='completed')throw new Error(result.error||'Synthèse interrompue. Le classement n’a pas changé.');
      reviewUndo=previous;plan=C.normalizePlan(result.plan,assets,{manual:true});renderReview();
      status('Synthèse globale récupérée. Contrôle les textes et les regroupements. « Annuler la dernière action » restaure ta proposition précédente.');
    }catch(e){status(e.message+' Le brouillon et tes corrections sont conservés.','error');}
    finally{setBusy(false);renderWarnings();persistReview();}
  }
  function exportReview(){
    if(!plan||!jobId)return;persistReview();
    const data={format:'wb-ai-review-v1',...remembered()},blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='WheelerBrothers_relecture_'+jobId+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('aiConsolidate').onclick=consolidateReview;
  $('aiSummaryFromTitles').onclick=()=>{if(!plan||busy)return;if(!confirm('Recomposer le résumé à partir des titres actuels des prestations et du bloc baie moteur ? Aucun appel IA.'))return;checkpointReview();rebuildSummary();resetApproval();};
  $('aiUndoReview').onclick=()=>{if(!reviewUndo||busy)return;const current=R.clone(plan);plan=R.clone(reviewUndo);reviewUndo=current;renderReview();status('La dernière modification structurelle a été annulée.');};
  $('aiExportReview').onclick=exportReview;
  $('aiAddSection').onclick=()=>{if(!plan||busy)return;if(plan.sections.length>=35){status('Maximum 35 prestations.','error');return;}checkpointReview();const sid=id('manual',8);plan.sections.push({id:sid,title:'Nouvelle prestation',description:'',type:'normal'});refreshReviewStructure();resetApproval();showIssue({sectionId:sid});};
  $('aiBayExpected').onchange=()=>{if(!plan||busy)return;checkpointReview();plan.engineBayExpected=$('aiBayExpected').checked;updateProblems();resetApproval();};
  $('aiImportReview').onchange=async e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file||busy)return;
    try{
      if(file.size>1000000)throw new Error('Fichier de relecture trop volumineux.');
      const stored=JSON.parse(await file.text());if(stored.format!=='wb-ai-review-v1'||!/^rai[a-f0-9]{32}$/.test(stored.jobId)||!stored.review?.plan)throw new Error('Export de relecture invalide.');
      if(!confirm('Restaurer cette relecture ? Les photos seront récupérées depuis Firebase, sans analyse IA.'))return;
      setBusy(true);const result=await call('status',{jobId:stored.jobId});
      if(!['completed','applied'].includes(result.status))throw new Error('Les analyses de ce brouillon ne sont plus disponibles.');
      if(plan)checkpointReview();workflowRef=stored.workflowRef||null;jobId=stored.jobId;await consume(result,stored.review);
    }catch(err){status(err.message,'error');}finally{setBusy(false);}
  };
  async function consume(result, savedReview=null){
    jobId=result.jobId||jobId;remember();
    if(result.status==='not-found'){status('Ce transfert n’a pas de résultat serveur. Abandonne le brouillon incomplet pour recommencer.','error');return;}
    if(result.status==='discarded'){forget();reset();status('Ce brouillon a été abandonné.');return;}
    if(result.assets?.length){
      const old=new Map(assets.map(a=>[a.id,a]));
      let manifest=result.assets;
      if(savedReview && ['completed','applied'].includes(result.status) && Array.isArray(savedReview.assets)){
        const merged=new Map(manifest.map(a=>[a.id,a]));
        savedReview.assets.forEach(a=>{if(/^a[a-f0-9]{24}$/.test(a.id||'') && typeof a.name==='string' && a.name.length<=200)merged.set(a.id,a);});
        if(merged.size<=LIMIT)manifest=[...merged.values()];
      }
      assets=manifest.map(a=>({...a,...(old.get(a.id)||{})}));
      for(const a of assets){if(!a.url)a.url=await H.storage().ref().child(`spaces/${H.space()}/reports/${jobId}/ai-${a.id}.${a.ext||'jpg'}`).getDownloadURL();}
      documents=(result.documents||[]).map(d=>({...d,pages:d.pages.map(page=>({...page,url:page.url||''}))}));
      for(const d of documents)for(const page of d.pages)if(!page.url)page.url=await H.storage().ref().child(`spaces/${H.space()}/reports/${jobId}/ai-inv-${page.id}.jpg`).getDownloadURL();
      requestInput={jobId,assets:result.assets,documents:result.documents||[],notes:result.notes,meta:result.meta,consent:true,mode:result.assets.every(a=>a.ext)?'batches':undefined};
      setMeta(result.meta||{});$('aiNotes').value=result.notes||'';
    }
    usage=result.usage||null;
    if(result.status==='completed'||result.status==='applied'){
      if(savedReview?.plan){
        // Never overwrite the user's hand-edited order, exclusions or captions on resume.
        plan=C.normalizePlan(R.clone(savedReview.plan),assets,{manual:true});
        reviewUndo=null;
        if(savedReview.undo){try{reviewUndo=C.normalizePlan(R.clone(savedReview.undo),assets,{manual:true});}catch{ /* Invalid old undo must not block the valid saved review. */ }}
        reviewCharges=savedReview.charges&&typeof savedReview.charges==='object'?savedReview.charges:{};
      }else{plan=C.normalizePlan(result.plan,assets);reviewUndo=null;reviewCharges={};}
      renderReview();status('Classement prêt. Vérifie notamment les références, les photos ambiguës et les côtés. Aucun rapport n’a été remplacé.');return;
    }
    $('aiRetryArea').hidden=false;
    $('aiRetry').hidden=result.status!=='failed';
    $('aiRefresh').textContent=result.status==='partial'?'Continuer les lots restants (appels facturables)':'Vérifier le résultat existant';
    if(result.status==='failed'){status((result.error||'Préparation interrompue.')+`\n${result.processedImages||0} / ${result.totalImages||0} photos analysées, ${result.doneBatches||0}/${result.totalBatches||0} lots conservés.`, 'error');return;}
    if(result.status==='partial'){status(`Lots terminés : ${result.doneBatches} / ${result.totalBatches}. Reprise possible sans réanalyser les précédents.`);return;}
    status('Un lot est encore en cours côté serveur. Vérifie son résultat avant toute relance.');
  }
  async function runBatches(retry=false){
    let result=await call('prepare',{...requestInput,retry});
    while(result.status==='partial'){
      const done=result.processedImages||0,total=result.totalImages||requestInput.assets.length;
      status(result.phase==='synthesis'?`Synthèse globale du rapport : ${total} photos analysées. Regroupement des prestations, résumé unique et références (texte uniquement).`:`Analyse IA par lots : ${done} / ${total} photos — ${result.doneBatches} / ${result.totalBatches} lot(s) terminés. Les lots précédents sont conservés.`);
      result=await call('prepare',{...requestInput,retry:false});
    }
    return result;
  }
  async function generate(retry=false){
    if(busy)return;
    if(!retry && !$('aiPlate').reportValidity())return;
    if(!retry && ((jobId&&requestInput)||(remembered()?.jobId&&!jobId&&!remembered()?.uploadPending))){status('Une préparation IA existe déjà. Reprends-la ou abandonne-la avant un nouvel envoi.','error');return;}
    if(!retry && remembered()?.uploadPending && remembered()?.manifest?.length && assets.length!==remembered().manifest.length){
      status(`Transfert interrompu : ${assets.length} / ${remembered().manifest.length} fichiers retrouvés. Resélectionne les autres photos avant de continuer.`,'error');return;
    }
    if(!retry && remembered()?.uploadPending && remembered()?.docManifest?.length && documents.length!==remembered().docManifest.length){
      status(`Transfert interrompu : ${documents.length} / ${remembered().docManifest.length} factures PDF retrouvées. Resélectionne les factures manquantes avant de continuer.`,'error');return;
    }
    if(!retry && (!assets.length || $('aiNotes').value.trim().length<10 || !$('aiConsent').checked)){
      status('Ajoute au moins une photo, décris les travaux et confirme l’envoi à OpenAI.','error');return;
    }
    if(!retry && rejectedFiles.size && !$('aiPartialConfirm').checked){
      status(rejectedFiles.size+' photo(s) ont été refusées. Ajoute-les de nouveau ou confirme explicitement une analyse partielle.','error');return;
    }
    if(retry && !confirm('Relancer uniquement l’étape en échec (lot ou synthèse globale) ? Cet appel est facturable. Les lots réussis ne seront pas réanalysés.'))return;
    setBusy(true);
    try{
      if(!retry){
        status('Vérification du service IA… Aucun appel OpenAI.');const caps=await call('capabilities');
        if(caps.version!=='56.3'||caps.mode!=='batches'||!caps.globalSynthesis)throw new Error('Serveur IA v56.5 requis pour la synthèse globale. Déploie wbReportAI avant de lancer une nouvelle analyse. Les anciens brouillons restent récupérables.');
        if(!jobId)jobId=id('rai',16);remember();await upload();
        requestInput={jobId,assets:assets.map(a=>({id:a.id,name:a.name,ext:a.ext})),documents:documents.map(d=>({id:d.id,name:d.name,pages:d.pages.map(p=>({id:p.id}))})),notes:$('aiNotes').value.trim(),meta:metaFromForm(),consent:true,mode:'batches'};
        remember();
      }
      $('aiInput').hidden=true;status('Analyse et préparation du classement… L’appel API est en cours.');
      const result=await runBatches(retry);await consume(result);
    }catch(e){
      status(e.message+(requestInput?'\nVérifie d’abord le résultat côté serveur avant tout nouvel appel IA.':'\nAucun appel OpenAI n’a été fait. Réessaie l’envoi des fichiers manquants.'), 'error');
      if(jobId){$('aiRetryArea').hidden=false;$('aiRetry').hidden=true;$('aiResume').hidden=false;}
    }finally{setBusy(false);}
  }
  async function resume(){
    if(busy)return;const stored=remembered();if(stored?.uploadPending){
      if(!jobId)jobId=stored.jobId;
      status(`Transfert non terminé. Resélectionne les ${stored.manifest?.length||0} mêmes photos et ${stored.docManifest?.length||0} facture(s) PDF éventuelles, puis clique sur « Préparer le rapport ». Les fichiers déjà reçus seront vérifiés et réutilisés.`);
      $('aiInput').hidden=false;$('aiReview').hidden=true;$('aiGenerate').disabled=false;return;
    }
    if(!jobId && stored?.jobId)jobId=stored.jobId;if(!jobId)return;
    setBusy(true);status('Récupération du brouillon existant… Aucun nouvel appel IA.');
    try{const result=await call('status',{jobId});await consume(result,stored?.review||null);if(result.status==='partial' && requestInput){await consume(await runBatches(false));}}catch(e){status(e.message,'error');}finally{setBusy(false);}
  }
  $('aiExtraFiles').addEventListener('change',async e=>{
    if(busy || !plan || !jobId)return;
    const selected=[...e.target.files];e.target.value='';const errors=[];setBusy(true);
    try{
      for(const file of selected){
        if(assets.length>=LIMIT){errors.push('Limite de '+LIMIT+' images atteinte.');break;}
        status('Ajout manuel de '+file.name+'… Aucun appel IA.');
        try{
          const prepared=await preparePhoto(file),blob=prepared.blob,a={id:id('a',12),name:file.name.slice(0,200),...prepared};
          if(a.original!==a.blob)await H.storage().ref().child(`spaces/${H.space()}/reports/${jobId}/ai-original-${a.id}.${a.originalExt}`).put(a.original,{contentType:a.original.type||'application/octet-stream'});
          const ref=H.storage().ref().child(`spaces/${H.space()}/reports/${jobId}/ai-${a.id}.${a.ext}`);
          await ref.put(blob,{contentType:contentType[a.ext],cacheControl:'private,max-age=3600'});
          a.url=await ref.getDownloadURL();a.preview=URL.createObjectURL(blob);assets.push(a);
          plan.photos.push({id:a.id,kind:'unassigned',sectionId:'',side:'',order:plan.photos.length,caption:'',reason:'Photo ajoutée manuellement : choisir sa prestation.'});
          persistReview();
        }catch(err){errors.push(file.name+' : '+err.message);}
      }
      renderReviewPhotos();resetApproval();
      status(errors.length?errors.join('\n'):'Photos ajoutées. Choisis leur affectation ci-dessous.',errors.length?'error':'');
    }finally{setBusy(false);}
  });
  function reset(){
    $('aiVehicleSelect').value='';
    assets.forEach(a=>{if(a.preview)URL.revokeObjectURL(a.preview);});assets=[];documents=[];vehicleKm=null;vehiclePlate='';rejectedFiles.clear();renderDocuments();plan=null;jobId='';requestInput=null;usage=null;reviewUndo=null;reviewCharges={};workflowRef=null;workflowOptions=[];renderWorkflowOptions();
    $('aiUploadProgress').textContent='';$('aiDiscard').hidden=true;$('aiInput').hidden=false;$('aiReview').hidden=true;$('aiRetryArea').hidden=true;setMeta({});$('aiNotes').value='';$('aiConsent').checked=false;renderInputPhotos();setBusy(false);
  }
  async function abandon(){
    if(busy)return;const pending=remembered();const target=jobId||pending?.jobId;if(!target)return;
    if(!confirm('Abandonner ce brouillon et supprimer ses photos de préparation ? Aucun rapport déjà créé ne sera supprimé.'))return;
    setBusy(true);
    try{const result=await call('status',{jobId:target});if(result.status!=='not-found')await call('discard',{jobId:target});forget();reset();status('Brouillon abandonné.');}
    catch(e){status(e.message,'error');}
    finally{setBusy(false);}
  }
  async function apply(){
    if(busy||!plan)return;
    const issues=R.issueList(plan);if(issues.length){updateProblems();$('aiProblems').scrollIntoView({block:'center'});status('Le rapport n’est pas encore créé. Corrige les points signalés ; chaque prestation conservée doit avoir ses photos.','error');return;}
    if(!$('aiApprove').checked){$('aiApprove').focus();$('aiApprove').scrollIntoView({block:'center'});status('Confirme la relecture avant de créer le rapport.','error');return;}
    setBusy(true);status('Création du nouveau rapport dans Atelier… Aucun nouvel appel IA.');
    try{
      const urls=Object.fromEntries(assets.map(a=>[a.id,a.url]));
      const report=C.makeReport(plan,assets,requestInput.meta,H.blank(),urls);
      report.km=WBVehicleInput.digits(report.km);
      if(WBVehicleInput.isFrench(report.plate))report.plate=WBVehicleInput.plate(report.plate);
      for(const d of documents)for(let i=0;i<d.pages.length;i++)report.invoices.push({id:'ai_pdf_'+d.id+'_'+i,kind:'img',src:d.pages[i].url,name:d.name+' p.'+(i+1)});
      report.invoicesOn=report.invoices.length>0;
      await H.apply(report,jobId,workflowRef);
      forget();dialog.close();reset();
    }catch(e){status('Le rapport n’a pas pu être ouvert : '+e.message+'. Le brouillon est conservé.','error');}
    finally{setBusy(false);}
  }
  function renderWorkflowOptions(){
    const sel=$('aiLinkedOperation');sel.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Aucune — rapport indépendant';sel.append(empty);
    workflowOptions.forEach(o=>{const opt=document.createElement('option');opt.value=o._planningOnly?'planning::'+o.planningId:o.vehicleId+'::'+o.id;opt.textContent=[o.plannedDates?.join(', ')||o.date||'Sans date',o.operation||'Intervention',(o.status||'done')==='done'?'Terminée':'Planifiée',o.reportId?'Rapport déjà associé':''].filter(Boolean).join(' — ');opt.disabled=!!o.reportId;sel.append(opt);});
    sel.value=workflowRef?(workflowRef.vehicleId?workflowRef.vehicleId+'::'+workflowRef.operationId:'planning::'+workflowRef.planningId):'';
    $('aiWorkflowHint').textContent=workflowRef?'Ce rapport sera rattaché à l’intervention choisie. Décris uniquement les travaux réellement effectués, pas les travaux restant à faire.':'Rapport indépendant. Clique sur « Vérifier » pour afficher les interventions du véhicule.';
  }
  $('aiLinkedOperation').onchange=()=>{const value=$('aiLinkedOperation').value;workflowRef=value?(value.startsWith('planning::')?{planningId:value.split('::')[1]}:{vehicleId:value.split('::')[0],operationId:value.split('::')[1]}):null;if(jobId)remember();renderWorkflowOptions();};
  async function open(context){
    await H.ready;
    if(context){
      if(jobId||assets.length||remembered()?.jobId){alert('Une préparation IA est déjà en cours. Reprends-la ou abandonne-la avant de commencer un autre rapport lié.');return;}
      const v=context.vehicle,op=context.operation,meta=window.WBVehicleInfo.fromVehicle(v);
      setMeta({plate:v.plate||'',brand:meta.brand,model:meta.model,engine:meta.engine,reg:meta.reg,km:op.km||'',date:(op.status||'done')==='done'?op.date||'':''});
      workflowRef=context.ref;workflowOptions=[{...op,vehicleId:v.id}];renderWorkflowOptions();
      $('aiWorkflowHint').textContent+=' Travaux initialement prévus : '+(op.operation||'');
    }
    if(!plan && !jobId){const previous=remembered();if(previous?.workflowRef){workflowRef=previous.workflowRef;const info=await WBWorkflow.call('operationInfo',workflowRef);workflowOptions=[{...info.operation,vehicleId:info.vehicle.id}];renderWorkflowOptions();}$('aiResume').hidden=!previous?.jobId;$('aiGenerate').disabled=Boolean(previous?.jobId&&!previous?.uploadPending);}
    dialog.showModal();void loadVehicles();
  }
  window.WBReportAI={open};window.dispatchEvent(new Event('wb-ai-ready'));
  $('aiGenerate').onclick=()=>generate(false);$('aiRetry').onclick=()=>generate(true);$('aiRefresh').onclick=resume;
  $('aiResumeBtn').onclick=resume;$('aiForget').onclick=abandon;$('aiDiscard').onclick=abandon;
  $('aiClose').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('aiApprove').onchange=updateProblems;$('aiSummary').onfocus=resetTextCheckpoint;$('aiSummary').oninput=e=>{if(plan){checkpointText(e);plan.summary=e.target.value;resetApproval();}};
  $('aiApply').onclick=apply;
  window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
  ['btnHomeAI','btnArchiveAI'].forEach(name=>{const b=document.getElementById(name);if(b){b.addEventListener('click',()=>{H.closeArchive();open();});H.ready.then(()=>b.disabled=false);}});
})();
