/* WheelerBrothers 56.5 — préparation volontaire, relecture obligatoire, nouveau rapport uniquement. */
(function(){
  'use strict';
  try {
  const C=window.WBReportAICore,H=window.WBReportAIHost,CFG=window.WB_REPORT_AI_CONFIG;
  if(!C || !H || !CFG?.enabled){window.WBReportAIBootError='Dépendance IA indisponible : '+(!C?'report-ai-core.js ': '')+(!H?'passerelle rapport ': '')+(!CFG?.enabled?'configuration IA désactivée':'');return;}
  const KEY='wb_ai_pending_v1';
  const LIMIT=Math.min(C.MAX_IMAGES,CFG.maxImages||100);
  const id=(prefix,n)=>prefix+Array.from(crypto.getRandomValues(new Uint8Array(n))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let assets=[],documents=[],plan=null,jobId='',busy=false,requestInput=null,usage=null,vehicleKm=null,vehiclePlate='',workflowRef=null,workflowOptions=[],vehicleRecords=[],rejectedFiles=new Map(),reviewUndo=[],synthesisRetry=false;
  const dialog=document.createElement('dialog');dialog.className='wb-ai-dialog no-print';dialog.id='wbAiDialog';
  dialog.setAttribute('aria-labelledby','aiTitle');
  const checks=H.blank().checkpoints;
  dialog.innerHTML=`<header class="wb-ai-head"><h2 id="aiTitle">Créer un rapport avec l’IA</h2><button type="button" class="btn ghost" id="aiClose" aria-label="Fermer">✕</button></header>
    <div class="wb-ai-body"><p class="wb-ai-notice">Ajoute tes photos et décris les travaux. L’IA propose un classement ; tu le relis avant de créer un <strong>nouveau</strong> rapport. Aucun ancien rapport n’est remplacé. Le rattachement reste facultatif ; la création ne termine pas l’intervention et ne partage pas le rapport.</p>
    <div id="aiResume" class="wb-ai-resume" hidden>Une préparation précédente est disponible. Si le transfert a été interrompu avant l'analyse, sélectionne de nouveau les mêmes fichiers : ceux déjà envoyés ne seront pas renvoyés.<div class="wb-ai-actions"><button class="btn" id="aiResumeBtn" type="button">Reprendre (lots restants potentiellement facturables)</button><button class="btn ghost" id="aiExportPending" type="button">Sauvegarder le brouillon local (.json)</button><button class="btn ghost" id="aiForget" type="button">Abandonner ce brouillon</button></div></div>
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
      <label class="wb-ai-check"><input type="checkbox" id="aiConsent"><span>J’autorise l’envoi de ces photos, factures PDF et notes à OpenAI pour préparer ce rapport. Plusieurs appels API facturables sont nécessaires (un par lot, puis une synthèse globale textuelle, sans renvoyer les photos) lorsque je cliquerai sur « Préparer le rapport ».</span></label>
      <div class="wb-ai-actions"><button type="button" class="btn primary" id="aiGenerate">Préparer le rapport</button></div>
    </section>
    <div id="aiStatus" class="wb-ai-status" role="status" aria-live="polite"></div>
    <div class="wb-ai-actions" id="aiRetryArea" hidden><button class="btn" type="button" id="aiRetry">Réessayer (nouvel appel API)</button><button class="btn ghost" type="button" id="aiRefresh">Vérifier le résultat existant</button></div>
    <div class="wb-ai-actions"><button type="button" class="btn ghost" id="aiDiscard" hidden>Abandonner ce brouillon</button></div><section id="aiReview" hidden><h3>Relire le classement</h3><p id="aiReviewCounts" class="wb-ai-muted" role="status"></p><div class="wb-ai-actions wb-ai-review-toolbar"><button type="button" class="btn ghost" id="aiUndo" disabled>Annuler le dernier déplacement / retrait</button><button type="button" class="btn ghost" id="aiTextSynthesis">Refaire la synthèse globale (textes)</button><button type="button" class="btn ghost" id="aiExportReview">Sauvegarder le brouillon (.json)</button><label class="filebtn btn ghost" for="aiImportReview">Importer un brouillon</label><input id="aiImportReview" type="file" accept="application/json,.json"></div><p class="wb-ai-muted">Les retraits sont réversibles : aucune photo originale n’est effacée de Storage. Le brouillon garde tes corrections sur cet appareil ; le fichier JSON permet aussi une sauvegarde de secours, sans inclure les photos elles-mêmes.</p><p class="wb-ai-muted">Corrige les titres et affectations. Pour déplacer une photo du chapitre A vers D, utilise la liste « Affectation » sous la miniature (avec choix gauche/droite), puis les flèches ‹ et › ou le champ Position pour régler son ordre directement dans le chapitre cible. Les opérations peuvent aussi être déplacées, fusionnées ou retirées. « Ne pas inclure » est un choix explicite, jamais automatique.</p>
      <label for="aiSummary">Résumé</label><textarea id="aiSummary" maxlength="1600"></textarea><button type="button" class="btn ghost" id="aiSummaryFromSections">Reconstruire le résumé depuis les opérations</button><p class="wb-ai-muted">Une synthèse globale, jamais une liste des lots. Ce bouton reconstruit localement le résumé à partir des intitulés retenus ; il ne relance pas l’IA.</p>
      <div id="aiSynthesisPreview" class="wb-ai-section-action" hidden></div><div id="aiSections"></div><div id="aiSectionAction" class="wb-ai-section-action" hidden></div><p class="wb-ai-notice">La baie moteur est un bloc avant / après séparé, après les recommandations. Affecte ses photos à « Baie moteur : avant » ou « après », pas à une prestation ordinaire. Si le stade est inconnu, il reste à préciser.</p><label class="filebtn btn ghost" for="aiExtraFiles">Ajouter des photos manquantes (sans nouvel appel IA)</label><input id="aiExtraFiles" type="file" accept="image/*" multiple><div id="aiReviewGallery" class="wb-ai-review-groups"></div><p id="aiPhotoOrderStatus" class="wb-ai-sr-only" role="status" aria-live="polite"></p>
      <div id="aiInvoiceReview" class="wb-ai-muted"></div><details id="aiWarningsBox"><summary>Points à vérifier (non imprimés)</summary><div id="aiWarnings" class="wb-ai-warnings"></div></details><div id="aiProblems" class="wb-ai-problems" role="status"></div><p id="aiUsage" class="wb-ai-usage"></p>
      <label class="wb-ai-check"><input type="checkbox" id="aiApprove"><span>J’ai relu les informations et le classement des photos. Créer le rapport ; si une intervention est sélectionnée, y rattacher le document sans la terminer ni le partager.</span></label>
      <p id="aiApplyHint" class="wb-ai-muted" role="status"></p><div class="wb-ai-actions"><button class="btn ghost" type="button" id="aiFixProblems" hidden>Voir les corrections nécessaires</button><button class="btn primary" type="button" id="aiApply" disabled>Créer le rapport dans l’éditeur</button></div>
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
    $('aiReview').querySelectorAll('.wb-ai-photo-move').forEach(el=>el.disabled=value||el.dataset.boundary==='true');
    $('aiReview').querySelectorAll('button').forEach(el=>{el.disabled=value;});
    if(!value)updateProblems();
    if(!value && plan){renderReviewPhotos();renderSectionControls();$('aiUndo').disabled=!reviewUndo.length;$('aiExportReview').disabled=false;$('aiSummaryFromSections').disabled=false;$('aiFixProblems').disabled=false;}
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
    const bar=window.WBProgress?.start('Transfert sécurisé des photos IA');
    let completed=0,nextIndex=0;
    function paint(){
      const sent=Math.min(totalBytes,[...progress.values()].reduce((n,x)=>n+x,0));
      const text=`Envoi sécurisé : ${(sent/1048576).toFixed(1)} / ${(totalBytes/1048576).toFixed(1)} Mio — ${completed} / ${totalFiles} photos terminées`;
      $('aiUploadProgress').textContent=text;
      bar?.update('Données transférées',sent,totalBytes,`${completed} / ${totalFiles} photos terminées`);
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
    try{paint();await Promise.all(Array.from({length:Math.min(parallel,assets.length)},()=>worker()));}finally{bar?.close();}
    if(failures.length)throw new Error(failures.length+' photo(s) non transmises :\n'+failures.join('\n')+'\nLes photos déjà envoyées seront conservées. Relance « Préparer le rapport » après vérification de ta connexion, ou resélectionne les mêmes fichiers si la page a été fermée.');
    $('aiUploadProgress').textContent=`${totalFiles} / ${totalFiles} photos envoyées — ${(totalBytes/1048576).toFixed(1)} Mio. Prêt pour l'analyse.`;
    for(const d of documents){
      const docRef=H.storage().ref().child(`spaces/${space}/reports/${jobId}/ai-doc-${d.id}.pdf`);
      if(d.uploaded){try{await docRef.getMetadata();}catch{d.uploaded=false;}}
      if(!d.uploaded){status('Envoi sécurisé de la facture '+d.name+'…');await docRef.put(d.blob,{contentType:'application/pdf'});d.uploaded=true;remember();}
      for(const page of d.pages){if(page.url)continue;const ref=H.storage().ref().child(`spaces/${space}/reports/${jobId}/ai-inv-${page.id}.jpg`);try{page.url=await ref.getDownloadURL();}catch{await ref.put(page.blob,{contentType:'image/jpeg'});page.url=await ref.getDownloadURL();}}
    }
  }
  function entryValue(p){
    if(p.kind==='section')return 'section|'+p.sectionId+'|'+(p.side||'');
    return p.kind;
  }
  function options(){
    let html='<option value="unassigned">À classer</option><option value="excluded">Ne pas inclure (choix manuel)</option>';
    const labels={overview:'Couverture : véhicule',products:'Sommaire : produits/pièces',labelR:'Étiquette entretien : recto',labelV:'Étiquette entretien : verso',baieAvant:'Baie moteur : avant',baieApres:'Baie moteur : après',invoice:'Facture en annexe'};
    Object.entries(labels).forEach(([k,v])=>html+=`<option value="${k}">${v}</option>`);
    plan.sections.forEach((s,i)=>{
      if(s.type==='sym') ['L','R'].forEach(side=>html+=`<option value="section|${s.id}|${side}">${i+1}. ${esc(s.title)} — ${side==='L'?'Gauche':'Droite'}</option>`);
      else html+=`<option value="section|${s.id}|">${i+1}. ${esc(s.title)}</option>`;
    });
    return html;
  }
  function persistReview(){
    if(!plan || !jobId)return;
    try{localStorage.setItem(KEY,JSON.stringify({...remembered(),jobId,workflowRef,uploadPending:false,review:{plan,assets:assets.map(a=>({id:a.id,name:a.name,ext:a.ext})),usage}}));}catch(e){status('Le classement reste ouvert, mais les corrections ne peuvent pas être conservées localement.','error');}
  }
  function resetApproval(){$('aiApprove').checked=false;updateProblems();persistReview();}
  function namedMessage(message){
    let out=String(message||'');
    for(const a of assets)out=out.split(a.id).join(a.name||a.id);
    return out;
  }
  function updateProblems(){
    if(!plan){$('aiApply').disabled=true;return;}
    const issues=C.reviewIssues(plan),excluded=plan.photos.filter(p=>p.kind==='excluded').length;
    const unassigned=plan.photos.filter(p=>p.kind==='unassigned').length;
    $('aiReviewCounts').textContent=`${assets.length} photos comptabilisées : ${plan.photos.length-excluded-unassigned} classées, ${unassigned} à classer, ${excluded} retirées du rapport.`;
    $('aiProblems').hidden=!issues.length;
    $('aiProblems').innerHTML=issues.length?'<strong>À corriger avant de créer le rapport :</strong>'+issues.map((issue,i)=>`<div class="wb-ai-issue"><span>${esc(namedMessage(issue.message))}</span><button type="button" class="btn ghost" data-issue="${i}">Corriger</button>${issue.empty?`<button type="button" class="btn ghost" data-empty-section="${esc(issue.sectionId)}">Retirer l’opération vide</button>`:''}</div>`).join(''):'';
    $('aiProblems').querySelectorAll('[data-issue]').forEach(button=>button.onclick=()=>{
      const issue=issues[Number(button.dataset.issue)];
      if(issue.photoId){focusReviewPhoto(issue.photoId,'.wb-ai-target');return;}
      const el=issue.sectionId?[...$('aiSections').querySelectorAll('[data-section]')].find(x=>x.dataset.section===issue.sectionId):$('aiSummary');
      el?.scrollIntoView({block:'center'});el?.querySelector('input')?.focus({preventScroll:true});
    });
    $('aiProblems').querySelectorAll('[data-empty-section]').forEach(b=>b.onclick=()=>requestSectionRemoval(b.dataset.emptySection));
    $('aiApply').disabled=busy||issues.length>0||!$('aiApprove').checked;
    $('aiFixProblems').hidden=!issues.length;
    $('aiApplyHint').textContent=busy?'Une opération est en cours…':issues.length?`${issues.length} correction(s) requise(s). Réaffecte les photos ou retire les opérations indésirables. Une prestation conservée doit être illustrée.`:!$('aiApprove').checked?'Le contenu est prêt. Coche « J’ai relu… » pour activer la création.':'Tout est prêt : tu peux créer le rapport dans l’éditeur.';
    $('aiApply').title=$('aiApplyHint').textContent;
  }
  function checkpointReview(){
    reviewUndo.push(JSON.stringify(plan));if(reviewUndo.length>20)reviewUndo.shift();$('aiUndo').disabled=false;
  }
  function refreshReview(){renderSections();renderReviewPhotos();resetApproval();}
  function reviewPhotos(target){
    // Match makeReport's stable sort, including equal AI order values.
    return plan.photos.filter(p=>entryValue(p)===target).sort((a,b)=>a.order-b.order);
  }
  function reviewGroups(){
    // Follow the printable report: cover, contents, prestations, maintenance,
    // engine bay, then invoices. Left/right galleries stay independent.
    const groups=[{target:'overview',title:'Couverture — véhicule'},{target:'products',title:'Sommaire — produits / pièces'}];
    plan.sections.forEach((s,i)=>{
      const title=`${i+1}. ${s.title||'Prestation sans titre'}`;
      if(s.type==='sym') ['L','R'].forEach(side=>groups.push({target:`section|${s.id}|${side}`,title:title+' — '+(side==='L'?'Gauche':'Droite')}));
      else groups.push({target:`section|${s.id}|`,title});
    });
    groups.push(
      {target:'labelR',title:'Étiquette d’entretien — recto'},
      {target:'labelV',title:'Étiquette d’entretien — verso'},
      {target:'baieAvant',title:'Baie moteur — avant'},
      {target:'baieApres',title:'Baie moteur — après'},
      {target:'invoice',title:'Factures en annexe'},
      {target:'unassigned',title:'Photos à classer'},
      {target:'excluded',title:'Photos non incluses'}
    );
    return groups.map(group=>({...group,photos:reviewPhotos(group.target)})).filter(group=>group.photos.length);
  }
  function focusReviewPhoto(photoId,selector){
    const tile=[...$('aiReviewGallery').querySelectorAll('[data-photo]')].find(el=>el.dataset.photo===photoId);
    const control=tile?.querySelector(selector)||tile?.querySelector('.wb-ai-photo-move:not(:disabled)')||tile?.querySelector('.wb-ai-target');
    control?.focus({preventScroll:true});
    tile?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function moveReviewPhoto(photoId,step,absolute){
    if(busy||!plan)return;
    const photo=plan.photos.find(p=>p.id===photoId);if(!photo)return;
    const photos=reviewPhotos(entryValue(photo)),from=photos.indexOf(photo),position=absolute===undefined?from+step+1:absolute;
    if(!Number.isInteger(position)||position<1||position>photos.length){status(`Position attendue entre 1 et ${photos.length}.`,'error');renderReviewPhotos();return;}
    if(position===from+1)return;
    checkpointReview();C.movePhoto(plan,photoId,position);
    renderReviewPhotos();resetApproval();focusReviewPhoto(photoId,'.wb-ai-position');
    $('aiPhotoOrderStatus').textContent=`${assets.find(a=>a.id===photoId)?.name||'Photo'} : position ${position} sur ${photos.length}.`;
  }
  function renderReviewPhotos(){
    const opts=options(),assetById=new Map(assets.map(a=>[a.id,a]));
    $('aiReviewGallery').innerHTML=reviewGroups().map(group=>`<section class="wb-ai-photo-group" data-photo-group="${esc(group.target)}" aria-label="${esc(group.title)}"><div class="wb-ai-group-head"><h4>${esc(group.title)} · ${group.photos.length} photo(s)</h4>${group.photos.length>1&&group.target!=='invoice'?`<button type="button" class="btn ghost" data-sort-gallery="${esc(group.target)}">Trier par nom / numéro</button>`:''}</div><div class="wb-ai-gallery">${group.photos.map((p,i)=>{
      const a=assetById.get(p.id)||{name:p.id,url:''};
      const arrow=(step,boundary)=>`<button type="button" class="btn ghost wb-ai-photo-move" data-step="${step}" data-boundary="${boundary}" title="${step<0?'Déplacer avant':'Déplacer après'}" aria-label="${step<0?'Avancer':'Reculer'} ${esc(a.name)} d’une place"${busy||boundary?' disabled':''}>${step<0?'‹':'›'}</button>`;
      return `<div class="wb-ai-tile" data-photo="${esc(p.id)}" data-unassigned="${p.kind==='unassigned'}"><div class="wb-ai-photo-tools">${arrow(-1,i===0)}<label class="wb-ai-position-label">Position<input class="wb-ai-position" type="number" inputmode="numeric" min="1" max="${group.photos.length}" value="${i+1}" aria-label="Position de ${esc(a.name)}"><span>/ ${group.photos.length}</span></label>${arrow(1,i===group.photos.length-1)}</div><a href="${esc(a.url)}" target="_blank" rel="noopener"><img src="${esc(a.preview||a.url)}" loading="lazy" alt="${esc(a.name)}"></a><div class="wb-ai-name">${esc(a.name)}</div><select class="wb-ai-target" aria-label="Affectation de ${esc(a.name)}"${busy?' disabled':''}>${opts}</select><div class="wb-ai-reason">${esc(namedMessage(p.reason))}</div><label>Légende (facultative)<textarea class="wb-ai-cap" maxlength="350"${busy?' disabled':''}>${esc(p.caption)}</textarea></label><button type="button" class="btn ghost wb-ai-remove-photo">${p.kind==='excluded'?'Rétablir la photo':'Retirer du rapport'}</button></div>`;
    }).join('')}</div></section>`).join('');
    $('aiReviewGallery').querySelectorAll('[data-sort-gallery]').forEach(b=>b.onclick=()=>{
      if(busy||!confirm('Remplacer l’ordre de cette galerie par le tri naturel des noms de fichiers ? Les autres galeries ne changent pas.'))return;
      checkpointReview();C.sortGalleryByFilename(plan,assets,b.dataset.sortGallery);renderReviewPhotos();resetApproval();
    });
    $('aiReviewGallery').querySelectorAll('[data-photo]').forEach(tile=>{
      const p=plan.photos.find(p=>p.id===tile.dataset.photo),select=tile.querySelector('.wb-ai-target');select.value=entryValue(p);
      select.onchange=()=>{
        if(busy)return;checkpointReview();
        if(select.value==='excluded')C.excludePhoto(plan,p.id);
        else{
          const parts=select.value.split('|');p.kind=parts[0];p.sectionId=parts[1]||'';p.side=parts[2]||'';p.reason='';delete p.excludedFrom;
          const destination=reviewPhotos(entryValue(p)).filter(photo=>photo!==p);destination.push(p);destination.forEach((photo,i)=>photo.order=i);
        }
        renderReviewPhotos();resetApproval();focusReviewPhoto(p.id,'.wb-ai-target');
      };
      tile.querySelectorAll('.wb-ai-photo-move').forEach(button=>button.onclick=()=>moveReviewPhoto(p.id,Number(button.dataset.step)));
      const pos=tile.querySelector('.wb-ai-position');pos.onchange=()=>moveReviewPhoto(p.id,0,Number(pos.value));
      pos.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();pos.blur();}};
      tile.querySelector('.wb-ai-cap').oninput=e=>{p.caption=e.target.value;resetApproval();};
      tile.querySelector('.wb-ai-remove-photo').onclick=()=>{if(busy)return;checkpointReview();p.kind==='excluded'?C.restorePhoto(plan,p.id):C.excludePhoto(plan,p.id);renderReviewPhotos();resetApproval();};
    });
  }
  function renderSectionControls(){
    $('aiSections').querySelectorAll('[data-section]').forEach((card,i)=>{
      card.querySelectorAll('button').forEach(b=>b.disabled=busy);
      card.querySelector('[data-section-step="-1"]').disabled=busy||i===0;
      card.querySelector('[data-section-step="1"]').disabled=busy||i===plan.sections.length-1;
    });
  }
  function renderSections(){
    $('aiSections').innerHTML=plan.sections.map((s,i)=>`<div class="wb-ai-section" data-section="${esc(s.id)}"><div class="wb-ai-section-tools"><strong>Opération ${i+1} / ${plan.sections.length}</strong><button type="button" class="btn ghost" data-section-step="-1" aria-label="Monter ${esc(s.title)}">↑</button><button type="button" class="btn ghost" data-section-step="1" aria-label="Descendre ${esc(s.title)}">↓</button><label>Position<input type="number" class="ai-sposition" min="1" max="${plan.sections.length}" value="${i+1}" inputmode="numeric"></label><button type="button" class="btn ghost ai-sremove">Supprimer / fusionner</button></div><label>Titre<input class="ai-stitle" maxlength="160" value="${esc(s.title)}"></label><label>Références / description<textarea class="ai-sdesc" maxlength="1600" placeholder="Marque et référence, une ligne par produit">${esc(s.description)}</textarea></label><button type="button" class="btn ghost ai-sclean">Retirer les lignes répétées</button><label>Présentation<select class="ai-stype"><option value="normal">Simple</option><option value="sym">Gauche / droite</option></select></label>${C.isEngineBay(s.title)?'<p class="wb-ai-warning">La baie moteur appartient au bloc spécial. Utilise « Supprimer / fusionner » puis « Bloc baie moteur » pour y réaffecter les photos.</p>':''}</div>`).join('');
    $('aiSections').querySelectorAll('[data-section]').forEach(card=>{
      const s=plan.sections.find(s=>s.id===card.dataset.section);card.querySelector('.ai-stype').value=s.type;
      card.querySelector('.ai-stitle').oninput=e=>{s.title=e.target.value;renderReviewPhotos();resetApproval();};
      card.querySelector('.ai-sdesc').oninput=e=>{s.description=e.target.value;resetApproval();};
      card.querySelector('.ai-sclean').onclick=()=>{checkpointReview();s.description=C.cleanDescription(s.description);refreshReview();};
      card.querySelector('.ai-stype').onchange=e=>{checkpointReview();s.type=e.target.value;plan.photos.filter(p=>p.kind==='section'&&p.sectionId===s.id).forEach(p=>{p.side='';if(s.type==='sym'){p.kind='unassigned';p.reason='Choisir le côté gauche ou droit.';}});refreshReview();};
      function move(position){if(busy)return;const from=plan.sections.indexOf(s);if(!Number.isInteger(position)||position<1||position>plan.sections.length){status('Position d’opération invalide.','error');renderSections();return;}if(position===from+1)return;checkpointReview();C.moveSection(plan,s.id,position);refreshReview();const current=[...$('aiSections').querySelectorAll('[data-section]')].find(c=>c.dataset.section===s.id);current?.scrollIntoView({block:'nearest'});}
      card.querySelectorAll('[data-section-step]').forEach(b=>b.onclick=()=>move(plan.sections.indexOf(s)+1+Number(b.dataset.sectionStep)));
      card.querySelector('.ai-sposition').onchange=e=>move(Number(e.target.value));
      card.querySelector('.ai-sposition').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur();}};
      card.querySelector('.ai-sremove').onclick=()=>requestSectionRemoval(s.id);
    });renderSectionControls();
  }
  function requestSectionRemoval(sectionId){
    if(busy)return;
    const s=plan.sections.find(s=>s.id===sectionId);if(!s)return;
    const count=plan.photos.filter(p=>p.kind==='section'&&p.sectionId===sectionId).length;
    if(!count){if(!confirm('Retirer l’opération vide « '+s.title+' » ? Elle ne figurera plus dans le rapport.'))return;checkpointReview();C.dropSection(plan,sectionId);refreshReview();return;}
    const panel=$('aiSectionAction');panel.hidden=false;
    panel.innerHTML=`<h4>Supprimer / fusionner : ${esc(s.title)}</h4><p>Cette opération contient ${count} photo(s). Choisis leur destination. Aucun fichier original ne sera effacé.</p><label>Destination des photos<select id="aiSectionDestination"><option value="unassigned">Conserver les photos dans « À classer »</option>${plan.sections.filter(x=>x.id!==sectionId&&(x.type==='normal'||s.type==='sym')).map(x=>`<option value="${esc(x.id)}">Fusionner avec : ${esc(x.title)}</option>`).join('')}<option value="engineBay" ${C.isEngineBay(s.title)?'selected':''}>Bloc baie moteur — préciser avant / après ensuite</option><option value="excluded">Retirer aussi ces photos du rapport (réversible)</option></select></label><div class="wb-ai-actions"><button type="button" class="btn" id="aiSectionConfirm">Confirmer</button><button type="button" class="btn ghost" id="aiSectionCancel">Annuler</button></div>`;
    panel.scrollIntoView({block:'center'});
    $('aiSectionCancel').onclick=()=>{panel.hidden=true;};
    $('aiSectionConfirm').onclick=()=>{
      const targetId=$('aiSectionDestination').value,target=plan.sections.find(s=>s.id===targetId);checkpointReview();
      try{
        if(target)target.description=C.cleanDescription(target.description+'\n'+s.description);
        C.dropSection(plan,sectionId,targetId);panel.hidden=true;refreshReview();
        status(target?'Opérations fusionnées. Les photos et références ont été conservées une seule fois ; vérifie leur ordre.':'Opération retirée. Vérifie les affectations des photos avant de créer le rapport.');
      }catch(e){status(e.message,'error');}
    };
  }
  function renderReview(){
    $('aiInput').hidden=true;$('aiReview').hidden=false;$('aiResume').hidden=true;$('aiRetryArea').hidden=true;
    $('aiSummary').value=plan.summary;
    renderSections();
    renderReviewPhotos();
    $('aiInvoiceReview').textContent=documents.length?'Factures jointes automatiquement en fin de rapport : '+documents.map(d=>d.name+' ('+d.pages.length+' pages)').join(' ; '):'';
    const notes=plan.warnings.filter(w=>!(/^(?:Lot \d|Photos? manquantes?\s*:)|dans ce lot|lot partiel|classement du lot|après (?:réunion|fusion)|réunion des (?:autres )?lots/i.test(w)));$('aiWarnings').textContent=notes.map(namedMessage).join('\n');$('aiWarningsBox').hidden=!notes.length;
    $('aiUsage').textContent=usage?`Utilisation remontée par l’API : ${usage.inputTokens} tokens reçus, ${usage.outputTokens} générés (raisonnement inclus). Coût indicatif : ${Number(usage.estimatedUsd).toFixed(3)} $ — hors Firebase/taxes, tarifs ${usage.pricingDate}, pas une facture.`:'';
    resetApproval();
  }
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
        const local=JSON.parse(JSON.stringify(savedReview.plan));
        const excluded=new Map(local.photos.filter(p=>p.kind==='excluded').map(p=>[p.id,p.excludedFrom||null]));
        local.photos.forEach(p=>{if(p.kind==='excluded')p.kind='unassigned';});
        plan=C.normalizePlan(local,assets);
        plan.photos.forEach(p=>{if(excluded.has(p.id)){p.kind='excluded';if(excluded.get(p.id))p.excludedFrom=excluded.get(p.id);}});
      }else plan=C.normalizePlan(result.plan,assets);
      renderReview();status(savedReview?.plan?'Brouillon repris : tes textes, affectations et positions manuelles sont conservés. Aucun nouvel appel IA. Tu peux retirer les doublons ou les chapitres vides avant validation.':'Classement prêt. Vérifie les références, les photos ambiguës et les côtés. Aucun rapport n’a été remplacé.');return;
    }
    $('aiRetryArea').hidden=false;
    $('aiRetry').hidden=result.status!=='failed';
    $('aiRefresh').textContent=result.status==='partial'?'Continuer les lots restants (appels facturables)':'Vérifier le résultat existant';
    if(result.status==='failed'){status((result.error||'Préparation interrompue.')+`\n${result.processedImages||0} / ${result.totalImages||0} photos analysées, ${result.doneBatches||0}/${result.totalBatches||0} lots conservés.`, 'error');return;}
    if(result.status==='partial'){status(`Lots terminés : ${result.doneBatches} / ${result.totalBatches}. Reprise possible sans réanalyser les précédents.`);return;}
    status('Un lot est encore en cours côté serveur. Vérifie son résultat avant toute relance.');
  }
  async function runBatches(retry=false){
    const progress=window.WBProgress?.start('Analyse des lots IA');
    let result;
    try{
    progress?.update('Analyse du premier lot',0,requestInput.assets.length,'En attente du serveur');
    result=await call('prepare',{...requestInput,retry});
    while(result.status==='partial'){
      const done=result.processedImages||0,total=result.totalImages||requestInput.assets.length;
      progress?.update('Photos analysées',done,total,`${result.doneBatches||0} / ${result.totalBatches||'?'} lots terminés`);
      status(result.stage==='synthesis'?`Les ${total} photos ont été analysées. Synthèse globale des opérations et références… Un appel textuel, sans renvoyer les images.`:`Analyse IA par lots : ${done} / ${total} photos — ${result.doneBatches} / ${result.totalBatches} lot(s) terminés. Les lots précédents sont conservés.`);
      result=await call('prepare',{...requestInput,retry:false});
    }
    if(result.status==='completed'||result.status==='applied')progress?.update('Analyse et synthèse terminées',1,1,'Rapport prêt pour la relecture');
    return result;
    }finally{progress?.close();}
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
    if(retry && !confirm('Relancer uniquement l’étape en échec (lot ou synthèse globale) ? Ce nouvel appel peut consommer du crédit API. Les lots réussis sont conservés.'))return;
    setBusy(true);
    try{
      if(!retry){
        status('Vérification des capacités du serveur IA… Aucun appel OpenAI.');
        let caps;
        try { caps=await call('capabilities'); }
        catch (error) {
          throw new Error('Diagnostic IA — appel capabilities impossible. '+(error?.message||String(error))+'. Aucun appel OpenAI effectué.');
        }
        const expected={version:'56.5',mode:'batches',globalSynthesis:true};
        const valid=!!caps && typeof caps==='object' && caps.version===expected.version && caps.mode===expected.mode && caps.globalSynthesis===expected.globalSynthesis;
        if(!valid){
          const printable=v=>v===undefined?'absent':v===null?'null':JSON.stringify(v);
          const actual=caps && typeof caps==='object'?caps:{};
          const details='Version reçue : '+printable(actual.version)+' (attendue : 56.5) ; mode : '+printable(actual.mode)+' (attendu : batches) ; globalSynthesis : '+printable(actual.globalSynthesis)+' (attendu : true).';
          throw new Error('Diagnostic IA — réponse capabilities incompatible. '+details+' Fonction appelée : '+String(CFG.functionName)+' ; région : '+String(CFG.region)+'. Aucun appel OpenAI effectué. Transmets ce message pour identifier la différence, sans redéployer à l’aveugle.');
        }
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
    assets.forEach(a=>{if(a.preview)URL.revokeObjectURL(a.preview);});assets=[];documents=[];reviewUndo=[];vehicleKm=null;vehiclePlate='';rejectedFiles.clear();renderDocuments();plan=null;jobId='';requestInput=null;usage=null;workflowRef=null;workflowOptions=[];renderWorkflowOptions();
    synthesisRetry=false;$('aiSynthesisPreview').hidden=true;$('aiSectionAction').hidden=true;$('aiUploadProgress').textContent='';$('aiDiscard').hidden=true;$('aiInput').hidden=false;$('aiReview').hidden=true;$('aiRetryArea').hidden=true;setMeta({});$('aiNotes').value='';$('aiConsent').checked=false;renderInputPhotos();setBusy(false);
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
    if(busy || !plan || C.reviewProblems(plan).length || !$('aiApprove').checked)return;
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
  $('aiApprove').onchange=updateProblems;$('aiSummary').oninput=e=>{if(plan){plan.summary=e.target.value;resetApproval();}};
  $('aiTextSynthesis').onclick=async()=>{
    if(busy||!plan)return;
    if(!confirm('Refaire uniquement la synthèse des textes et regrouper les opérations en double ? Un appel IA textuel peut être facturé. Aucune photo ne sera renvoyée. Tu verras la proposition avant de l’appliquer ; tes corrections actuelles restent conservées.'+(synthesisRetry?'\nIl s’agit d’une nouvelle tentative de l’étape textuelle.':'')))return;
    const original=JSON.stringify(plan);persistReview();setBusy(true);status('Synthèse globale textuelle… Tes photos ne sont ni renvoyées ni réanalysées.');
    try{
      const result=await call('synthesizeReview',{jobId,plan:JSON.parse(original),assets:assets.map(a=>({id:a.id,name:a.name,ext:a.ext||'jpg'})),consent:true,retry:synthesisRetry});
      if(result.usage){usage=result.usage;persistReview();$('aiUsage').textContent=`Utilisation cumulée : ${usage.inputTokens} tokens reçus, ${usage.outputTokens} générés. Coût indicatif : ${Number(usage.estimatedUsd).toFixed(3)} $ — hors Firebase/taxes, tarifs ${usage.pricingDate}, pas une facture.`;}
      if(result.status!=='completed'){
        synthesisRetry=result.status==='failed';status(result.error||'Synthèse encore en cours. Réutilise ce bouton pour récupérer le résultat mis en cache ; les photos restent intactes.','error');return;
      }
      synthesisRetry=false;
      const proposed=C.normalizeReviewPlan(result.plan,assets),panel=$('aiSynthesisPreview');panel.hidden=false;
      panel.innerHTML=`<h3>Proposition de synthèse globale</h3><p><strong>Résumé :</strong> ${esc(proposed.summary)}</p>${proposed.sections.map(s=>`<div class="wb-ai-synthesis-section"><strong>${esc(s.title)}</strong><p>${esc(s.description).replace(/\n/g,'<br>')}</p></div>`).join('')}<p>Les ${proposed.photos.length} photos restent comptabilisées, y compris celles retirées. Si des opérations sont fusionnées, les galeries sont réunies en conservant l’ordre relatif choisi dans chaque galerie. Les vues de baie moteur sans stade avant/après certain restent à classer.</p><div class="wb-ai-actions"><button type="button" class="btn" id="aiAcceptSynthesis">Appliquer cette proposition</button><button type="button" class="btn ghost" id="aiRejectSynthesis">Garder mes textes et mon classement</button></div>`;
      $('aiRejectSynthesis').onclick=()=>{panel.hidden=true;status('Proposition non appliquée. Ton brouillon est inchangé.');};
      $('aiAcceptSynthesis').onclick=()=>{
        if(JSON.stringify(plan)!==original){status('Tu as modifié le brouillon depuis cette proposition. Elle n’est pas appliquée pour préserver tes corrections.','error');return;}
        checkpointReview();plan=proposed;panel.hidden=true;renderReview();persistReview();status('Synthèse appliquée. Vérifie les éventuelles photos de baie moteur à préciser. Le dernier changement peut être annulé.');
      };
      panel.scrollIntoView({block:'start'});status('Synthèse prête, non appliquée : relis la proposition puis choisis de la conserver ou non.');
    }catch(e){synthesisRetry=true;status('Synthèse non appliquée : '+e.message+'. Ton brouillon actuel reste conservé.','error');}
    finally{setBusy(false);}
  };
  $('aiFixProblems').onclick=()=>{$('aiProblems').scrollIntoView({block:'center'});};
  $('aiUndo').onclick=()=>{if(busy||!reviewUndo.length)return;plan=JSON.parse(reviewUndo.pop());$('aiSectionAction').hidden=true;refreshReview();$('aiSummary').value=plan.summary;$('aiUndo').disabled=!reviewUndo.length;};
  $('aiSummaryFromSections').onclick=()=>{
    if(busy||!plan||!confirm('Remplacer le résumé par les intitulés des opérations conservées et le bloc baie moteur présent ? Aucune analyse IA ne sera relancée.'))return;
    checkpointReview();plan.summary=C.summaryFromSections(plan);$('aiSummary').value=plan.summary;resetApproval();
  };
  function exportReview(){
    if(plan)persistReview();const value=remembered();if(!value?.jobId){status('Aucun brouillon à sauvegarder.','error');return;}
    const blob=new Blob([JSON.stringify({type:'wheelerbrothers-ai-review',version:'56.5',spaceId:H.space(),...value},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='WB-brouillon-IA-'+value.jobId+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  $('aiExportReview').onclick=exportReview;$('aiExportPending').onclick=exportReview;
  $('aiImportReview').onchange=async e=>{
    const f=e.target.files?.[0];e.target.value='';if(!f||busy)return;
    try{
      if(f.size>2000000)throw new Error('Brouillon JSON trop volumineux.');
      const v=JSON.parse(await f.text());
      if(v.type!=='wheelerbrothers-ai-review'||!/^rai[a-f0-9]{32}$/.test(v.jobId||'')||v.spaceId!==H.space()||!v.review?.plan)throw new Error('Ce fichier n’est pas un brouillon de relecture de cet atelier.');
      if(jobId&&jobId!==v.jobId)throw new Error('Un autre dossier est ouvert. Ferme-le avant d’importer ce brouillon.');
      if(!confirm('Reprendre le classement de ce fichier ? Les photos seront récupérées depuis le brouillon privé existant, sans analyse IA.'))return;
      localStorage.setItem(KEY,JSON.stringify(v));jobId=v.jobId;workflowRef=v.workflowRef||null;await resume();
    }catch(e){status('Import impossible : '+e.message,'error');}
  };
  $('aiApply').onclick=apply;
  window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
  ['btnHomeAI','btnArchiveAI'].forEach(name=>{const b=document.getElementById(name);if(b){b.addEventListener('click',()=>{H.closeArchive();open();});H.ready.then(()=>b.disabled=false);}});
  } catch(error) {
    window.WBReportAIBootError=String(error?.message||error);
    console.error('WheelerBrothers : initialisation du module IA impossible',error);
    window.dispatchEvent(new Event('wb-ai-boot-failed'));
  }
})();
