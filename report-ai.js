/* WheelerBrothers 56.6.2 — préparation volontaire, relecture obligatoire, nouveau rapport uniquement. */
(function(){
  'use strict';
  try {
  const C=window.WBReportAICore,H=window.WBReportAIHost,CFG=window.WB_REPORT_AI_CONFIG;
  if(!C || !H || !CFG?.enabled){window.WBReportAIBootError='Dépendance IA indisponible : '+(!C?'report-ai-core.js ': '')+(!H?'passerelle rapport ': '')+(!CFG?.enabled?'configuration IA désactivée':'');return;}
  // Protection contre un ancien module core encore chargé par le cache PWA.
  const isEngineBay = typeof C.isEngineBay === 'function' ? title => C.isEngineBay(title) : title => {
    const normalized=String(title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return /\b(baie moteur|compartiment moteur)\b/.test(normalized) && !/\b(admission|boite a air|filtre|joint|radiateur|distribution)\b/.test(normalized);
  };
  const LIMIT=Math.min(C.MAX_IMAGES,CFG.maxImages||100);
  const id=(prefix,n)=>prefix+Array.from(crypto.getRandomValues(new Uint8Array(n))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let assets=[],documents=[],plan=null,jobId='',busy=false,requestInput=null,usage=null,vehicleKm=null,vehiclePlate='',workflowRef=null,workflowOptions=[],vehicleRecords=[],rejectedFiles=new Map(),reviewUndo=[],synthesisRetry=false,recoveryIssues=[],recoveryOriginal=null,interrupted=false;
  const dialog=document.createElement('dialog');dialog.className='wb-ai-dialog no-print';dialog.id='wbAiDialog';
  dialog.setAttribute('aria-labelledby','aiTitle');
  const checks=H.blank().checkpoints;
  dialog.innerHTML=`<header class="wb-ai-head"><h2 id="aiTitle">Créer un rapport avec l’IA</h2><button type="button" class="btn ghost" id="aiClose" aria-label="Fermer">✕</button></header>
    <div class="wb-ai-body"><p class="wb-ai-notice">Garde cette page ouverte jusqu’à la création du rapport : en cas d’interruption, la préparation et ses corrections ne seront pas récupérables, et une analyse déjà lancée peut être facturée. Ajoute tes photos et décris les travaux. L’IA propose un classement ; tu le relis avant de créer un <strong>nouveau</strong> rapport. Aucun ancien rapport n’est remplacé. Le rattachement reste facultatif ; la création ne termine pas l’intervention et ne partage pas le rapport.</p>
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
      <label for="wb-ai-model">Modèle IA</label><select id="wb-ai-model" aria-describedby="wb-ai-model-status wb-ai-model-pricing" disabled></select>
      <p id="wb-ai-model-status" class="wb-ai-muted" role="status" aria-live="polite" hidden></p>
      <p id="wb-ai-model-pricing" class="wb-ai-muted" hidden>Le tarif Standard d’Astra est quatre fois celui de Sol par token.</p>
      <button type="button" class="btn ghost" id="wb-ai-model-retry" hidden>Réessayer la vérification</button>
      <div class="wb-ai-actions"><button type="button" class="btn primary" id="aiGenerate" disabled>Préparer le rapport</button><button type="button" class="btn ghost" id="aiUploadOnly">Transférer les fichiers sans analyse IA</button></div>
    </section>
    <div id="aiStatus" class="wb-ai-status" role="status" aria-live="polite"></div>
    <section id="aiReview" hidden><h3>Relire le classement</h3><p id="aiReviewCounts" class="wb-ai-muted" role="status"></p><div class="wb-ai-actions wb-ai-review-toolbar"><button type="button" class="btn ghost" id="aiUndo" disabled>Annuler le dernier déplacement / retrait</button><button type="button" class="btn ghost" id="aiTextSynthesis">Refaire la synthèse globale (textes)</button></div><p class="wb-ai-muted">Les retraits sont réversibles pendant cette session : aucune photo originale n’est effacée de Storage. Les corrections ne sont pas conservées si tu fermes la page avant de créer le rapport.</p><p class="wb-ai-muted">Corrige les titres et affectations. Pour déplacer une photo du chapitre A vers D, utilise la liste « Affectation » sous la miniature (avec choix gauche/droite), puis les flèches ‹ et › ou le champ Position pour régler son ordre directement dans le chapitre cible. Les opérations peuvent aussi être déplacées, fusionnées ou retirées. « Ne pas inclure » est un choix explicite, jamais automatique.</p>
      <label for="aiSummary">Résumé</label><textarea id="aiSummary" maxlength="1600"></textarea><button type="button" class="btn ghost" id="aiSummaryFromSections">Reconstruire le résumé depuis les opérations</button><p class="wb-ai-muted">Une synthèse globale, jamais une liste des lots. Ce bouton reconstruit localement le résumé à partir des intitulés retenus ; il ne relance pas l’IA.</p>
      <div id="aiSynthesisPreview" class="wb-ai-section-action" hidden></div><div id="aiSections"></div><div id="aiSectionAction" class="wb-ai-section-action" hidden></div><p class="wb-ai-notice">La baie moteur est un bloc avant / après séparé, après les recommandations. Affecte ses photos à « Baie moteur : avant » ou « après », pas à une prestation ordinaire. Si le stade est inconnu, il reste à préciser.</p><label class="filebtn btn ghost" for="aiExtraFiles">Ajouter des photos manquantes (sans nouvel appel IA)</label><input id="aiExtraFiles" type="file" accept="image/*" multiple><div id="aiReviewGallery" class="wb-ai-review-groups"></div><p id="aiPhotoOrderStatus" class="wb-ai-sr-only" role="status" aria-live="polite"></p>
      <div id="aiRecoveryIssues" class="wb-ai-problems" role="status" hidden></div><div id="aiInvoiceReview" class="wb-ai-muted"></div><details id="aiWarningsBox"><summary>Points à vérifier (non imprimés)</summary><div id="aiWarnings" class="wb-ai-warnings"></div></details><div id="aiProblems" class="wb-ai-problems" role="status"></div><p id="aiUsage" class="wb-ai-usage"></p>
      <label class="wb-ai-check"><input type="checkbox" id="aiApprove"><span>J’ai relu les informations et le classement des photos. Créer le rapport ; si une intervention est sélectionnée, y rattacher le document sans la terminer ni le partager.</span></label>
      <p id="aiApplyHint" class="wb-ai-muted" role="status"></p><div class="wb-ai-actions"><button class="btn ghost" type="button" id="aiFixProblems" hidden>Voir les corrections nécessaires</button><button class="btn primary" type="button" id="aiApply" disabled>Créer le rapport dans l’éditeur</button></div>
    </section></div>`;
  document.body.appendChild(dialog);
  const $=name=>dialog.querySelector('#'+name);
  const modelSelect=$('wb-ai-model'),modelStatus=$('wb-ai-model-status'),modelRetry=$('wb-ai-model-retry'),modelPricing=$('wb-ai-model-pricing');
  let modelOptions=new Map(),selectedModel='',modelRequest=0;
  function status(message,kind=''){ $('aiStatus').textContent=message;$('aiStatus').dataset.kind=kind; }
  // Aucune sauvegarde locale ni lecture ou suppression des anciennes données.
  function remember(){}
  function remembered(){return null;}
  function forget(){}
  function setBusy(value){
    busy=value;
    ['aiClose','aiUploadOnly','aiFiles','aiPdfFiles','aiVerify','aiApply','aiVehicleSelect','aiReloadVehicles'].forEach(k=>{$(k).disabled=value;});
    $('aiInput').querySelectorAll('input,textarea').forEach(el=>el.disabled=value);
    $('aiReview').querySelectorAll('input,textarea,select').forEach(el=>el.disabled=value);
    $('aiReview').querySelectorAll('.wb-ai-photo-move').forEach(el=>el.disabled=value||el.dataset.boundary==='true');
    $('aiReview').querySelectorAll('button').forEach(el=>{el.disabled=value;});
    if(interrupted){$('aiUploadOnly').disabled=true;$('aiFiles').disabled=true;$('aiPdfFiles').disabled=true;}
    updateModelControls();
    if(!value)updateProblems();
    if(!value && plan){renderReviewPhotos();renderSectionControls();$('aiUndo').disabled=!reviewUndo.length;$('aiSummaryFromSections').disabled=false;$('aiFixProblems').disabled=false;}
  }
  async function call(action,extra={},timeoutMs=510000){
    await H.ready;
    if(typeof window.firebase?.app!=='function' || typeof firebase.app().functions!=='function')throw new Error('Le module Firebase Functions n’a pas été chargé. Recharge la page avec une connexion active.');
    const fn=firebase.app().functions(CFG.region).httpsCallable(CFG.functionName,{timeout:timeoutMs});
    try{return (await fn({action,...extra})).data;}
    catch(e){
      const code=e.code||'';
      if(code.includes('not-found') || code.includes('internal') || code.includes('unavailable'))throw new Error('Service IA inaccessible. Vérifie le déploiement de la fonction wbReportAI et sa région. Aucun résultat n’a été appliqué.');
      throw new Error(e.message||'Connexion au service IA impossible.');
    }
  }
  function updateModelControls(){
    modelSelect.disabled=busy||interrupted||Boolean(requestInput)||!modelOptions.size;
    $('aiGenerate').disabled=modelSelect.disabled||!modelOptions.has(modelSelect.value);
    modelRetry.disabled=busy;
  }
  function modelOption(value,label){
    const option=document.createElement('option');
    option.value=value;option.textContent=label;
    return option;
  }
  function showModelStatus(message){
    modelStatus.textContent=message;modelStatus.hidden=!message;
  }
  function availableModels(caps){
    if(caps?.version!=='56.5'||caps.mode!=='batches'||caps.globalSynthesis!==true||!Array.isArray(caps.models))return null;
    const options=new Map();
    for(const entry of caps.models){
      if(typeof entry?.id!=='string'||!entry.id.trim()||typeof entry.label!=='string'||!entry.label.trim()||options.has(entry.id))return null;
      options.set(entry.id,entry.label);
    }
    return options.has(caps.defaultModel)?options:null;
  }
  async function loadModels(preferredModel=selectedModel){
    const request=++modelRequest;
    const isCurrent=()=>dialog.open&&request===modelRequest;
    selectedModel=preferredModel;
    modelOptions.clear();modelRetry.hidden=true;modelPricing.hidden=true;
    modelSelect.replaceChildren(modelOption('','Vérification des modèles…'));
    showModelStatus('Vérification des modèles disponibles sur le serveur IA…');
    updateModelControls();
    try{
      const caps=await call('capabilities',{},15000);
      if(!isCurrent())return false;
      const options=availableModels(caps);
      if(!options)throw new Error('Le serveur IA ne propose pas le choix du modèle. Vérifie que la mise à jour du serveur Firebase est déployée.');
      modelOptions=options;
      selectedModel=preferredModel?options.has(preferredModel)?preferredModel:'':caps.defaultModel;
      modelSelect.replaceChildren(...Array.from(options,([value,label])=>modelOption(value,label)));
      if(!selectedModel){
        const placeholder=modelOption('','Choisir un modèle disponible');
        placeholder.disabled=true;modelSelect.prepend(placeholder);
      }
      modelSelect.value=selectedModel;
      modelPricing.hidden=!(options.has('gpt-6.2-sol')&&options.has('gpt-6.2-astra'));
      showModelStatus(selectedModel?'':'Le modèle choisi n’est plus disponible. Sélectionne un modèle pour continuer.');
      return Boolean(selectedModel);
    }catch(error){
      if(!isCurrent())return false;
      modelSelect.replaceChildren(modelOption('','Modèles indisponibles'));
      showModelStatus((error.message||'Impossible de vérifier les modèles IA.')+' Cette vérification ne lance aucune analyse OpenAI.');
      modelRetry.hidden=false;
      return false;
    }finally{
      if(isCurrent())updateModelControls();
    }
  }
  modelSelect.onchange=()=>{
    selectedModel=modelSelect.value;
    if(modelOptions.has(selectedModel))showModelStatus('');
    updateModelControls();
  };
  modelRetry.onclick=()=>{if(!busy&&!requestInput)void loadModels();};
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
          pages.push({id:previous?.pages[i]?.id||id('a',12),blob,recovered:Boolean(previous),attempted:Boolean(previous?.pages[i]?.attempted),uploaded:Boolean(previous?.pages[i]?.uploaded)});
        }
        documents.push({id:previous?.id||id('d',12),name:f.name.slice(0,160),sourceSize:f.size,lastModified:f.lastModified,uploaded:Boolean(previous?.uploaded),attempted:Boolean(previous?.attempted),recovered:Boolean(previous),blob:f,pages});
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
      status('Une analyse est déjà en cours : les photos ne peuvent plus être modifiées ici.','error');return;
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
            ...prepared,uploaded:Boolean(existing?.uploaded),originalUploaded:Boolean(existing?.originalUploaded),mainAttempted:Boolean(existing?.mainAttempted),originalAttempted:Boolean(existing?.originalAttempted),recovered:Boolean(existing),preview:URL.createObjectURL(blob)});
          rejectedFiles.delete(f.name+'-'+f.size);
        }catch(err){const message=f.name+' : '+err.message;errors.push(message);rejectedFiles.set(f.name+'-'+f.size,message);}
      }
      if(recovering){
        const positions=new Map(pending.manifest.map((a,i)=>[a.id,i]));
        assets.sort((a,b)=>(positions.get(a.id)??999)-(positions.get(b.id)??999));
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
  // Le transfert vérifie l’identité d’un objet avant toute réutilisation dans cette session.
  async function upload(){
    const space=H.space(), parallel=3;
    const totalFiles=assets.length;
    const bytesOf=a=>a.blob.size+(a.original!==a.blob?a.original.size:0);
    const totalBytes=assets.reduce((n,a)=>n+bytesOf(a),0);
    const progress=new Map(),failures=[];
    const transferApi=window.WBAITransfer;
    if(!transferApi||!window.md5?.create)throw new Error('Les composants de vérification photo sont indisponibles. Recharge la page avant de réessayer.');
    const bar=window.WBProgress?.start('Transfert sécurisé des photos IA');
    let completed=0,nextIndex=0;
    function paint(){
      const sent=Math.min(totalBytes,[...progress.values()].reduce((n,x)=>n+x,0));
      const text=`Envoi sécurisé : ${(sent/1048576).toFixed(1)} / ${(totalBytes/1048576).toFixed(1)} Mio — ${completed} / ${totalFiles} photos terminées`;
      $('aiUploadProgress').textContent=text;
      bar?.update('Données transférées',sent,totalBytes,`${completed} / ${totalFiles} photos terminées`);
      status(text+'\nAucun appel OpenAI à cette étape.');
    }
    const retryNotice=()=>status('Vérification du transfert et nouvelle tentative limitée. Aucun appel OpenAI.');
    async function transfer(ref,blob,mime,key){
      progress.set(key,0);
      await transferApi.put(ref,blob,{contentType:mime,cacheControl:'private,max-age=3600'},
        {onProgress:snap=>{progress.set(key,snap.bytesTransferred||0);paint();},onRetry:retryNotice});
      progress.set(key,blob.size);paint();
    }
    async function sendPhoto(a){
      const key=a.id+':main',originalKey=a.id+':original';
      const raw=a.original!==a.blob;
      const originalPath=`spaces/${space}/reports/${jobId}/ai-original-${a.id}.${a.originalExt}`;
      const path=`spaces/${space}/reports/${jobId}/ai-${a.id}.${a.ext}`;
      const ref=H.storage().ref().child(path);
      if(raw){
        const originalRef=H.storage().ref().child(originalPath);
        if(!a.originalVerified&&(a.originalUploaded||a.recovered||a.originalAttempted)){
          a.originalUploaded=await transferApi.existsAndMatches(originalRef,a.original,retryNotice);
          a.originalVerified=true;remember();
        }
        if(!a.originalUploaded){a.originalAttempted=true;a.originalVerified=false;remember();await transfer(originalRef,a.original,a.original.type||'application/octet-stream',originalKey);a.originalUploaded=true;a.originalVerified=true;remember();}
        progress.set(originalKey,a.original.size);
      }
      if(!a.mainVerified&&(a.uploaded||a.recovered||a.mainAttempted)){
        a.uploaded=await transferApi.existsAndMatches(ref,a.blob,retryNotice);
        a.mainVerified=true;remember();
      }
      if(!a.uploaded){a.mainAttempted=true;a.mainVerified=false;remember();await transfer(ref,a.blob,contentType[a.ext],key);a.uploaded=true;a.mainVerified=true;remember();}
      if(!a.url)a.url=await transferApi.url(ref,retryNotice);
      progress.set(key,a.blob.size);completed++;remember();paint();
    }
    async function worker(){
      while(nextIndex<assets.length){
        const index=nextIndex++,a=assets[index];
        try{await sendPhoto(a);}catch(error){failures.push(a.name+' : '+(error?.message||'échec réseau'));remember();}
      }
    }
    try{paint();await Promise.all(Array.from({length:Math.min(parallel,assets.length)},()=>worker()));}finally{bar?.close();}
    if(failures.length)throw new Error(failures.length+' photo(s) non transmises :\n'+failures.join('\n')+'\nLes photos originales et les fichiers déjà envoyés sont conservés.');
    $('aiUploadProgress').textContent=`${totalFiles} / ${totalFiles} photos envoyées — ${(totalBytes/1048576).toFixed(1)} Mio. Prêt pour l'analyse.`;
    for(const d of documents){
      const docRef=H.storage().ref().child(`spaces/${space}/reports/${jobId}/ai-doc-${d.id}.pdf`);
      if(!d.originalVerified&&(d.uploaded||d.recovered||d.attempted)){
        d.uploaded=await transferApi.existsAndMatches(docRef,d.blob,retryNotice);d.originalVerified=true;remember();
      }
      if(!d.uploaded){status('Envoi sécurisé de la facture '+d.name+'…');d.attempted=true;d.originalVerified=false;remember();await transferApi.put(docRef,d.blob,{contentType:'application/pdf'},{onRetry:retryNotice});d.uploaded=true;d.originalVerified=true;remember();}
      for(const page of d.pages){
        if(page.url)continue;
        const ref=H.storage().ref().child(`spaces/${space}/reports/${jobId}/ai-inv-${page.id}.jpg`);
        const reconcileFirst=Boolean(page.recovered||page.uploaded||page.attempted);
        page.attempted=true;remember();
        await transferApi.put(ref,page.blob,{contentType:'image/jpeg'},{reconcileFirst,onRetry:retryNotice});
        page.uploaded=true;remember();page.url=await transferApi.url(ref,retryNotice);
      }
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
  // Les corrections de relecture restent uniquement en mémoire durant la session.
  function persistReview(){}
  function resetApproval(){$('aiApprove').checked=false;updateProblems();persistReview();}
  function namedMessage(message){
    let out=String(message||'');
    for(const a of assets)out=out.split(a.id).join(a.name||a.id);
    return out;
  }
  function updateProblems(){
    if(!plan){$('aiApply').disabled=true;return;}
    const issues=C.reviewIssues(plan),pendingRecovery=recoveryIssues.filter(x=>!x.resolved),excluded=plan.photos.filter(p=>p.kind==='excluded').length;
    const unassigned=plan.photos.filter(p=>p.kind==='unassigned').length;
    $('aiReviewCounts').textContent=`${assets.length} photos comptabilisées : ${plan.photos.length-excluded-unassigned} classées, ${unassigned} à classer, ${excluded} retirées du rapport.`;
    $('aiProblems').hidden=!issues.length;renderRecoveryIssues();
    $('aiProblems').innerHTML=issues.length?'<strong>À corriger avant de créer le rapport :</strong>'+issues.map((issue,i)=>`<div class="wb-ai-issue"><span>${esc(namedMessage(issue.message))}</span><button type="button" class="btn ghost" data-issue="${i}">Corriger</button>${issue.empty?`<button type="button" class="btn ghost" data-allow-empty="${esc(issue.sectionId)}">Conserver sans photo</button><button type="button" class="btn ghost" data-empty-section="${esc(issue.sectionId)}">Retirer l’opération vide</button>`:''}</div>`).join(''):'';
    $('aiProblems').querySelectorAll('[data-issue]').forEach(button=>button.onclick=()=>{
      const issue=issues[Number(button.dataset.issue)];
      if(issue.photoId){focusReviewPhoto(issue.photoId,'.wb-ai-target');return;}
      const el=issue.sectionId?[...$('aiSections').querySelectorAll('[data-section]')].find(x=>x.dataset.section===issue.sectionId):$('aiSummary');
      el?.scrollIntoView({block:'center'});el?.querySelector('input')?.focus({preventScroll:true});
    });
    $('aiProblems').querySelectorAll('[data-empty-section]').forEach(b=>b.onclick=()=>requestSectionRemoval(b.dataset.emptySection));
    $('aiProblems').querySelectorAll('[data-allow-empty]').forEach(b=>b.onclick=()=>allowEmptySection(b.dataset.allowEmpty));
    $('aiApply').disabled=busy||issues.length>0||pendingRecovery.length>0||!$('aiApprove').checked;
    $('aiFixProblems').hidden=!(issues.length||pendingRecovery.length);
    $('aiApplyHint').textContent=busy?'Une opération est en cours…':pendingRecovery.length?`${pendingRecovery.length} référence(s) problématique(s) à examiner dans « Récupération des photos ». Examine les références avant de confirmer.`:issues.length?`${issues.length} correction(s) requise(s). Classe les photos, retire les opérations indésirables ou confirme celles à conserver sans photo.`:!$('aiApprove').checked?'Le contenu est prêt. Coche « J’ai relu… » pour activer la création.':'Tout est prêt : tu peux créer le rapport dans l’éditeur.';
    $('aiApply').title=$('aiApplyHint').textContent;
  }
  // Les anomalies portent sur des propositions d'affectation, pas sur des
  // fichiers à supprimer. Les choix restent en mémoire durant la session.
  function renderRecoveryIssues(){
    const area=$('aiRecoveryIssues');if(!area)return;
    const unresolved=recoveryIssues.map((entry,index)=>({...entry,issueIndex:index})).filter(x=>!x.resolved);
    area.hidden=!unresolved.length;
    if(!unresolved.length){area.replaceChildren();return;}
    const nameById=new Map(assets.map(a=>[a.id,a.name||a.id]));
    const describe=p=>{
      if(!p||typeof p!=='object')return 'Référence non structurée';
      const section=plan?.sections?.find(s=>s.id===p.sectionId);
      const place=p.kind==='section'?(section?.title||'Prestation '+String(p.sectionId||'')):String(p.kind||'Non classée');
      return [place,p.side&&('côté '+p.side),p.caption].filter(Boolean).join(' — ').slice(0,400);
    };
    area.innerHTML=`<h4>Récupération des références photo · ${unresolved.length} à vérifier</h4><p>Le serveur a renvoyé plusieurs affectations pour une même photo, ou une référence absente du manifeste. Les fichiers originaux ne sont pas supprimés. Confirme ton choix pour chaque anomalie avant de créer le rapport. Aucun appel IA n’est nécessaire.</p>`+unresolved.map(issue=>{
      const title=esc(nameById.get(issue.id)||issue.id||'Identifiant absent');
      const details=issue.type==='duplicate'
        ?`<p>Deux placements pour <strong>${title}</strong>. Photo conservée une seule fois.</p><p>1. ${esc(describe(issue.original))}</p><p>2. ${esc(describe(issue.entry))}</p><div class="wb-ai-actions"><button class="btn ghost" type="button" data-recovery="${issue.issueIndex}" data-choice="original">Garder le placement 1</button><button class="btn ghost" type="button" data-recovery="${issue.issueIndex}" data-choice="alternate">Garder le placement 2</button></div>`
        :`<p>Référence inconnue : <strong>${title}</strong></p><p>${esc(describe(issue.entry))}</p><p>Cette référence n’est pas dans les fichiers sélectionnés. Toutes les photos connues sont conservées, mais cette entrée doit être vérifiée avant d’être ignorée.</p><button class="btn ghost" type="button" data-recovery="${issue.issueIndex}" data-choice="ignore">J’ai vérifié : ignorer cette référence uniquement</button>`;
      return `<div class="wb-ai-issue" style="display:block;padding:12px 0">${details}</div>`;
    }).join('');
    area.querySelectorAll('[data-recovery]').forEach(button=>button.onclick=()=>{
      if(busy||!plan)return;
      const issue=recoveryIssues[Number(button.dataset.recovery)];if(!issue||issue.resolved)return;
      const choice=button.dataset.choice;
      const prompt=choice==='ignore'
        ?'Confirmer que cette référence inconnue ne correspond à aucun fichier sélectionné ? Aucun fichier ne sera supprimé.'
        :'Conserver le placement '+(choice==='alternate'?'2':'1')+' pour cette photo ? Le dernier changement pourra être annulé durant cette session.';
      if(!confirm(prompt))return;
      let nextPhoto=null;
      if(issue.type==='duplicate'){
        try{
          const entry=choice==='alternate'?issue.entry:issue.original;
          const normalized=C.recoverPlan({summary:plan.summary,sections:plan.sections,photos:[entry],warnings:[]},[{id:issue.id}]);
          nextPhoto=normalized.plan.photos.find(p=>p.id===issue.id);
        }catch(error){status('Placement impossible à appliquer : '+error.message,'error');return;}
      }
      checkpointReview();
      if(nextPhoto){const current=plan.photos.find(p=>p.id===issue.id);if(current)Object.assign(current,nextPhoto);}
      issue.resolved=true;refreshReview();persistReview();
      status('Référence examinée. Les fichiers originaux sont conservés ; les choix restent disponibles pendant cette session.');
    });
  }
  function checkpointReview(){
    reviewUndo.push(JSON.stringify({plan,recoveryIssues}));if(reviewUndo.length>20)reviewUndo.shift();$('aiUndo').disabled=false;
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
  function allowEmptySection(sectionId){
    if(busy||!plan)return;
    const section=plan.sections.find(s=>s.id===sectionId);
    if(!section||section.allowWithoutPhotos===true||plan.photos.some(p=>p.kind==='section'&&p.sectionId===sectionId))return;
    if(!confirm('Conserver l’opération « '+section.title+' » sans photo dans le rapport ?'))return;
    checkpointReview();section.allowWithoutPhotos=true;refreshReview();
    status('Opération conservée sans photo. Tu peux annuler ce choix dans sa fiche.');
  }
  function revokeEmptySection(sectionId){
    if(busy||!plan)return;
    const section=plan.sections.find(s=>s.id===sectionId);
    if(!section||section.allowWithoutPhotos!==true)return;
    checkpointReview();delete section.allowWithoutPhotos;refreshReview();
    status('Choix annulé. Une opération sans photo devra être corrigée ou confirmée à nouveau.');
  }
  function invalidateEmptyChoice(section,card){
    if(section.allowWithoutPhotos!==true)return;
    delete section.allowWithoutPhotos;
    card?.querySelector('.wb-ai-empty-choice')?.remove();
    status('L’opération a changé : confirme à nouveau si tu veux la conserver sans photo.');
  }
  function renderSections(){
    $('aiSections').innerHTML=plan.sections.map((s,i)=>`<div class="wb-ai-section" data-section="${esc(s.id)}"><div class="wb-ai-section-tools"><strong>Opération ${i+1} / ${plan.sections.length}</strong><button type="button" class="btn ghost" data-section-step="-1" aria-label="Monter ${esc(s.title)}">↑</button><button type="button" class="btn ghost" data-section-step="1" aria-label="Descendre ${esc(s.title)}">↓</button><label>Position<input type="number" class="ai-sposition" min="1" max="${plan.sections.length}" value="${i+1}" inputmode="numeric"></label><button type="button" class="btn ghost ai-sremove">Supprimer / fusionner</button></div><label>Titre<input class="ai-stitle" maxlength="160" value="${esc(s.title)}"></label><label>Références / description<textarea class="ai-sdesc" maxlength="1600" placeholder="Marque et référence, une ligne par produit">${esc(s.description)}</textarea></label><button type="button" class="btn ghost ai-sclean">Retirer les lignes répétées</button><label>Présentation<select class="ai-stype"><option value="normal">Simple</option><option value="sym">Gauche / droite</option></select></label>${s.allowWithoutPhotos===true?'<div class="wb-ai-empty-choice"><p>Choix confirmé : cette opération peut être conservée sans photo.</p><button type="button" class="btn ghost ai-srevoke-empty">Annuler ce choix</button></div>':''}${isEngineBay(s.title)?'<p class="wb-ai-warning">La baie moteur appartient au bloc spécial. Utilise « Supprimer / fusionner » puis « Bloc baie moteur » pour y réaffecter les photos.</p>':''}</div>`).join('');
    $('aiSections').querySelectorAll('[data-section]').forEach(card=>{
      const s=plan.sections.find(s=>s.id===card.dataset.section);card.querySelector('.ai-stype').value=s.type;
      card.querySelector('.ai-stitle').oninput=e=>{if(s.title!==e.target.value)invalidateEmptyChoice(s,card);s.title=e.target.value;renderReviewPhotos();resetApproval();};
      card.querySelector('.ai-sdesc').oninput=e=>{if(s.description!==e.target.value)invalidateEmptyChoice(s,card);s.description=e.target.value;resetApproval();};
      card.querySelector('.ai-sclean').onclick=()=>{checkpointReview();const next=C.cleanDescription(s.description);if(next!==s.description)invalidateEmptyChoice(s,card);s.description=next;refreshReview();};
      card.querySelector('.ai-stype').onchange=e=>{checkpointReview();if(s.type!==e.target.value)invalidateEmptyChoice(s,card);s.type=e.target.value;plan.photos.filter(p=>p.kind==='section'&&p.sectionId===s.id).forEach(p=>{p.side='';if(s.type==='sym'){p.kind='unassigned';p.reason='Choisir le côté gauche ou droit.';}});refreshReview();};
      function move(position){if(busy)return;const from=plan.sections.indexOf(s);if(!Number.isInteger(position)||position<1||position>plan.sections.length){status('Position d’opération invalide.','error');renderSections();return;}if(position===from+1)return;checkpointReview();C.moveSection(plan,s.id,position);refreshReview();const current=[...$('aiSections').querySelectorAll('[data-section]')].find(c=>c.dataset.section===s.id);current?.scrollIntoView({block:'nearest'});}
      card.querySelectorAll('[data-section-step]').forEach(b=>b.onclick=()=>move(plan.sections.indexOf(s)+1+Number(b.dataset.sectionStep)));
      card.querySelector('.ai-sposition').onchange=e=>move(Number(e.target.value));
      card.querySelector('.ai-sposition').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur();}};
      card.querySelector('.ai-sremove').onclick=()=>requestSectionRemoval(s.id);
      const revoke=card.querySelector('.ai-srevoke-empty');if(revoke)revoke.onclick=()=>revokeEmptySection(s.id);
    });renderSectionControls();
  }
  function requestSectionRemoval(sectionId){
    if(busy)return;
    const s=plan.sections.find(s=>s.id===sectionId);if(!s)return;
    const count=plan.photos.filter(p=>p.kind==='section'&&p.sectionId===sectionId).length;
    if(!count){if(!confirm('Retirer l’opération vide « '+s.title+' » ? Elle ne figurera plus dans le rapport.'))return;checkpointReview();C.dropSection(plan,sectionId);refreshReview();return;}
    const panel=$('aiSectionAction');panel.hidden=false;
    panel.innerHTML=`<h4>Supprimer / fusionner : ${esc(s.title)}</h4><p>Cette opération contient ${count} photo(s). Choisis leur destination. Aucun fichier original ne sera effacé.</p><label>Destination des photos<select id="aiSectionDestination"><option value="unassigned">Conserver les photos dans « À classer »</option>${plan.sections.filter(x=>x.id!==sectionId&&(x.type==='normal'||s.type==='sym')).map(x=>`<option value="${esc(x.id)}">Fusionner avec : ${esc(x.title)}</option>`).join('')}<option value="engineBay" ${isEngineBay(s.title)?'selected':''}>Bloc baie moteur — préciser avant / après ensuite</option><option value="excluded">Retirer aussi ces photos du rapport (réversible)</option></select></label><div class="wb-ai-actions"><button type="button" class="btn" id="aiSectionConfirm">Confirmer</button><button type="button" class="btn ghost" id="aiSectionCancel">Annuler</button></div>`;
    panel.scrollIntoView({block:'center'});
    $('aiSectionCancel').onclick=()=>{panel.hidden=true;};
    $('aiSectionConfirm').onclick=()=>{
      const targetId=$('aiSectionDestination').value,target=plan.sections.find(s=>s.id===targetId);checkpointReview();
      try{
        if(target){invalidateEmptyChoice(target);target.description=C.cleanDescription(target.description+'\n'+s.description);}
        C.dropSection(plan,sectionId,targetId);panel.hidden=true;refreshReview();
        status(target?'Opérations fusionnées. Les photos et références ont été conservées une seule fois ; vérifie leur ordre.':'Opération retirée. Vérifie les affectations des photos avant de créer le rapport.');
      }catch(e){status(e.message,'error');}
    };
  }
  function renderUsage(){
    const model=usage?.model||requestInput?.model;
    const details=[];
    if(model)details.push(`Modèle IA : ${modelOptions.get(model)||model}.`);
    if(usage){
      const scope=usage.reviewSynthesis?'Utilisation de la synthèse de relecture':'Utilisation remontée par l’API';
      if(Number.isFinite(usage.inputTokens)&&Number.isFinite(usage.outputTokens)){
        details.push(`${scope} : ${usage.inputTokens} tokens reçus, ${usage.outputTokens} générés (raisonnement inclus).`);
      }
      const cost=usage.estimatedUsd;
      if(Number.isFinite(cost)&&cost>=0){
        const amount=cost>0&&cost<0.001?'< 0,001':cost.toLocaleString('fr-FR',{minimumFractionDigits:3,maximumFractionDigits:3});
        const date=usage.pricingDate?` (tarifs du ${usage.pricingDate})`:'';
        details.push(`Coût indicatif : ${amount} $ US, hors Firebase et taxes${date}.`);
      }else details.push('Estimation du coût indisponible.');
    }else if(model)details.push('Estimation du coût indisponible.');
    $('aiUsage').textContent=details.join(' ');
  }
  function renderReview(){
    $('aiInput').hidden=true;$('aiReview').hidden=false;
    $('aiSummary').value=plan.summary;
    renderSections();
    renderReviewPhotos();
    $('aiInvoiceReview').textContent=documents.length?'Factures jointes automatiquement en fin de rapport : '+documents.map(d=>d.name+' ('+d.pages.length+' pages)').join(' ; '):'';
    const notes=plan.warnings.filter(w=>!(/^(?:Lot \d|Photos? manquantes?\s*:)|dans ce lot|lot partiel|classement du lot|après (?:réunion|fusion)|réunion des (?:autres )?lots/i.test(w)));$('aiWarnings').textContent=notes.map(namedMessage).join('\n');$('aiWarningsBox').hidden=!notes.length;
    renderUsage();
    resetApproval();
  }
  async function consume(result, savedReview=null){
    jobId=result.jobId||jobId;
    if(result.status==='not-found'){interrupted=true;status('Le résultat est introuvable. Ferme cette fenêtre pour recommencer. Une analyse déjà lancée peut être facturée.','error');return;}
    if(result.status==='discarded'){interrupted=true;status('La préparation est indisponible. Ferme cette fenêtre pour recommencer.','error');return;}
    // Le job existe déjà côté serveur, même si le chargement des URL échoue.
    // Après rechargement, récupérer son statut au lieu de demander un transfert vide.
    remember({serverJob:true});
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
      const model=result.model||requestInput?.model;
      requestInput={jobId,assets:result.assets,documents:result.documents||[],notes:result.notes,meta:result.meta,consent:true,mode:result.assets.every(a=>a.ext)?'batches':undefined,...(model?{model}:{})};
      setMeta(result.meta||{});$('aiNotes').value=result.notes||'';
    }
    remember({serverJob:true});
    usage=result.usage||null;
    if(result.status==='completed'||result.status==='applied'){
      recoveryIssues=[];recoveryOriginal=null;
      const source=savedReview?.plan||result.plan;
      if(!source)throw new Error('Résultat IA absent : aucun appel supplémentaire.');
      try{
        plan=savedReview?.plan?C.normalizeReviewPlan(source,assets):C.normalizePlan(source,assets);
        if(savedReview?.recoveryIssues?.length){
          recoveryIssues=JSON.parse(JSON.stringify(savedReview.recoveryIssues));
          recoveryOriginal=savedReview.recoveryOriginal||null;
        }
      }catch(validationError){
        // Le résultat serveur et la relecture locale sont non destructifs.
        // Aucune nouvelle analyse payante, aucun doublon publié par défaut.
        const recovered=C.recoverPlan(source,assets,{manualReview:Boolean(savedReview?.plan)});
        plan=recovered.plan;
        recoveryIssues=recovered.anomalies;
        recoveryOriginal=savedReview?.recoveryOriginal||recovered.original;
        if(savedReview?.recoveryIssues?.length){
          const previous=new Map(savedReview.recoveryIssues.map(x=>[x.type+'|'+x.index+'|'+x.id,x]));
          recoveryIssues.forEach(x=>{const prev=previous.get(x.type+'|'+x.index+'|'+x.id);if(prev?.resolved)x.resolved=true;});
        }
      }
      renderReview();persistReview();
      status(recoveryIssues.some(x=>!x.resolved)
        ?`${recoveryIssues.filter(x=>!x.resolved).length} référence(s) à examiner dans « Récupération des références photo » avant de créer le rapport.`
        :savedReview?.plan?'Brouillon repris : tes textes, affectations et positions manuelles sont conservés. Aucun nouvel appel IA.':'Classement prêt. Vérifie les références, les photos ambiguës et les côtés. Aucun rapport remplacé.');return;
    }
    interrupted=true;
    status((result.error||'La préparation IA a été interrompue.')+' Ferme cette fenêtre pour recommencer. Une analyse déjà lancée peut être facturée ; aucun appel supplémentaire ne sera effectué automatiquement.', 'error');
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
  async function generate(retry=false, uploadOnly=false){
    if(busy)return;
    if(interrupted){status('La préparation est interrompue. Ferme cette fenêtre pour recommencer. Une analyse déjà lancée peut être facturée.', 'error');return;}
    const requestedModel=modelSelect.value;
    if(!retry&&!uploadOnly&&!modelOptions.has(requestedModel))return;
    if(!retry && !$('aiPlate').reportValidity())return;
    if(!retry && ((jobId&&requestInput)||(remembered()?.jobId&&!jobId&&!remembered()?.uploadPending))){status('Une préparation IA existe déjà. Reprends-la ou abandonne-la avant un nouvel envoi.','error');return;}
    if(!retry && remembered()?.uploadPending && remembered()?.manifest?.length && assets.length!==remembered().manifest.length){
      status(`Transfert interrompu : ${assets.length} / ${remembered().manifest.length} fichiers retrouvés. Resélectionne les autres photos avant de continuer.`,'error');return;
    }
    if(!retry && remembered()?.uploadPending && remembered()?.docManifest?.length && documents.length!==remembered().docManifest.length){
      status(`Transfert interrompu : ${documents.length} / ${remembered().docManifest.length} factures PDF retrouvées. Resélectionne les factures manquantes avant de continuer.`,'error');return;
    }
    if(!retry && (!assets.length || (!uploadOnly && ($('aiNotes').value.trim().length<10 || !$('aiConsent').checked)))){
      status(uploadOnly?'Ajoute au moins une photo avant l’envoi.':'Ajoute au moins une photo, décris les travaux et confirme l’envoi à OpenAI.','error');return;
    }
    if(!retry && uploadOnly && rejectedFiles.size){
      status(rejectedFiles.size+' photo(s) ont été refusées. Corrige leur sélection ou réessaie avant de transférer les fichiers sans analyse IA.','error');return;
    }
    if(!retry && rejectedFiles.size && !$('aiPartialConfirm').checked){
      status(rejectedFiles.size+' photo(s) ont été refusées. Ajoute-les de nouveau ou confirme explicitement une analyse partielle.','error');return;
    }
    if(retry && !confirm('Relancer uniquement l’étape en échec (lot ou synthèse globale) ? Ce nouvel appel peut consommer du crédit API. Les lots réussis sont conservés.'))return;
    setBusy(true);
    try{
      if(!retry){
        if(!uploadOnly&&!(await loadModels(requestedModel)))return;
        if(!jobId)jobId=id('rai',16);remember();await upload();
        if(uploadOnly){status('Les fichiers ont été transférés sans analyse OpenAI. Garde cette fenêtre ouverte pour préparer le rapport.');return;}
        requestInput={jobId,assets:assets.map(a=>({id:a.id,name:a.name,ext:a.ext})),documents:documents.map(d=>({id:d.id,name:d.name,pages:d.pages.map(p=>({id:p.id}))})),notes:$('aiNotes').value.trim(),meta:metaFromForm(),consent:true,mode:'batches',model:requestedModel};
        remember();
      }
      $('aiInput').hidden=true;status('Analyse et préparation du classement… L’appel API est en cours.');
      const result=await runBatches(retry);await consume(result);
    }catch(e){
      interrupted=true;
      status(e.message+(requestInput?'\nUne analyse a pu être facturée. Aucun nouvel appel IA ne sera lancé automatiquement.':'\nAucun appel OpenAI n’a été fait.')+' Ferme cette fenêtre pour recommencer ; tes photos originales ne sont pas supprimées.', 'error');
    }finally{setBusy(false);}
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
    modelRequest++;modelOptions.clear();selectedModel='';modelSelect.replaceChildren();modelRetry.hidden=true;modelPricing.hidden=true;showModelStatus('');
    assets.forEach(a=>{if(a.preview)URL.revokeObjectURL(a.preview);});assets=[];documents=[];reviewUndo=[];recoveryIssues=[];recoveryOriginal=null;vehicleKm=null;vehiclePlate='';rejectedFiles.clear();renderDocuments();plan=null;jobId='';requestInput=null;usage=null;workflowRef=null;workflowOptions=[];renderWorkflowOptions();
    synthesisRetry=false;interrupted=false;$('aiSynthesisPreview').hidden=true;$('aiSectionAction').hidden=true;$('aiUploadProgress').textContent='';$('aiInput').hidden=false;$('aiReview').hidden=true;setMeta({});$('aiNotes').value='';$('aiConsent').checked=false;renderInputPhotos();setBusy(false);
  }
  async function apply(){
    if(busy || !plan || recoveryIssues.some(x=>!x.resolved) || C.reviewProblems(plan).length || !$('aiApprove').checked)return;
    setBusy(true);status('Création du nouveau rapport dans Atelier… Aucun nouvel appel IA.');
    try{
      const urls=Object.fromEntries(assets.map(a=>[a.id,a.url]));
      const aiBlank=H.blank(); delete aiBlank.photoOriginals; // The AI apply endpoint accepts a strict report schema.
      const report=C.makeReport(plan,assets,requestInput.meta,aiBlank,urls);
      report.km=WBVehicleInput.digits(report.km);
      if(WBVehicleInput.isFrench(report.plate))report.plate=WBVehicleInput.plate(report.plate);
      for(const d of documents)for(let i=0;i<d.pages.length;i++)report.invoices.push({id:'ai_pdf_'+d.id+'_'+i,kind:'img',src:d.pages[i].url,name:d.name+' p.'+(i+1)});
      report.invoicesOn=report.invoices.length>0;
      // Le navigateur transmet le choix à part, sans l'insérer lui-même dans le rapport.
      const sectionsWithoutPhotos=report.sections.flatMap((section,i)=>section.type==='normal'&&Array.isArray(section.photos)&&section.photos.length===0&&plan.sections[i]?.allowWithoutPhotos===true?[i]:[]);
      await H.apply(report,jobId,workflowRef,sectionsWithoutPhotos);
      forget();dialog.close();reset();
    }catch(e){status('Le rapport n’a pas pu être ouvert : '+e.message+'. Garde cette fenêtre ouverte pour vérifier la situation. Aucun nouvel appel IA n’a été lancé.','error');}
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
    if(dialog.open)return;
    if(context){
      if(jobId||assets.length){alert('Une préparation IA est déjà ouverte. Ferme-la avant de commencer un autre rapport lié.');return;}
      const v=context.vehicle,op=context.operation,meta=window.WBVehicleInfo.fromVehicle(v);
      setMeta({plate:v.plate||'',brand:meta.brand,model:meta.model,engine:meta.engine,reg:meta.reg,km:op.km||'',date:(op.status||'done')==='done'?op.date||'':''});
      workflowRef=context.ref;workflowOptions=[{...op,vehicleId:v.id}];renderWorkflowOptions();
      $('aiWorkflowHint').textContent+=' Travaux initialement prévus : '+(op.operation||'');
    }
    dialog.showModal();void loadVehicles();void loadModels();
  }
  window.WBReportAI={open};window.dispatchEvent(new Event('wb-ai-ready'));
  $('aiGenerate').onclick=()=>generate(false);$('aiUploadOnly').onclick=()=>generate(false,true);
  function closeSession(){
    if(busy)return;
    if((jobId||assets.length||documents.length||$('aiNotes').value.trim()) && !confirm('Fermer cette préparation ? La sélection et les modifications non enregistrées seront perdues. Une analyse déjà lancée peut être facturée. Les photos originales ne seront pas supprimées.'))return;
    dialog.close();reset();status('');
  }
  $('aiClose').onclick=closeSession;
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeSession();});
  $('aiApprove').onchange=updateProblems;$('aiSummary').oninput=e=>{if(plan){plan.summary=e.target.value;resetApproval();}};
  $('aiTextSynthesis').onclick=async()=>{
    if(busy||!plan||recoveryIssues.some(x=>!x.resolved))return;
    if(!confirm('Refaire uniquement la synthèse des textes et regrouper les opérations en double ? Un appel IA textuel peut être facturé. Aucune photo ne sera renvoyée. Tu verras la proposition avant de l’appliquer ; tes corrections actuelles restent conservées.'+(synthesisRetry?'\nIl s’agit d’une nouvelle tentative de l’étape textuelle.':'')))return;
    const original=JSON.stringify(plan);persistReview();setBusy(true);status('Synthèse globale textuelle… Tes photos ne sont ni renvoyées ni réanalysées.');
    try{
      const result=await call('synthesizeReview',{jobId,plan:JSON.parse(original),assets:assets.map(a=>({id:a.id,name:a.name,ext:a.ext||'jpg'})),consent:true,retry:synthesisRetry});
      if(result.usage){usage={...result.usage,reviewSynthesis:true};persistReview();renderUsage();}
      if(result.status!=='completed'){
        synthesisRetry=result.status==='failed';status(result.error||'Synthèse encore en cours. Réutilise ce bouton pour récupérer le résultat mis en cache ; les photos restent intactes.','error');return;
      }
      synthesisRetry=false;
      const proposed=C.normalizeReviewPlan(result.plan,assets),panel=$('aiSynthesisPreview');panel.hidden=false;
      // Ne jamais accepter une autorisation envoyée par l'IA. Après synthèse,
      // la conserver uniquement pour une section strictement identique, et
      // seulement si l'ensemble des identifiants montre qu'aucune fusion ou
      // suppression de section n'a eu lieu. Sinon, demander une nouvelle revue.
      const oldSections=new Map(plan.sections.map(s=>[s.id,s]));
      const sameSections=proposed.sections.length===plan.sections.length&&proposed.sections.every(s=>oldSections.has(s.id));
      let reconfirmEmpty=false;
      for(const section of proposed.sections){
        delete section.allowWithoutPhotos;
        const old=oldSections.get(section.id);
        if(sameSections&&old?.allowWithoutPhotos===true&&section.title===old.title&&section.description===old.description&&section.type===old.type)section.allowWithoutPhotos=true;
      }
      reconfirmEmpty=plan.sections.some(s=>s.allowWithoutPhotos===true&&!proposed.sections.some(p=>p.id===s.id&&p.allowWithoutPhotos===true));
      panel.innerHTML=`<h3>Proposition de synthèse globale</h3><p><strong>Résumé :</strong> ${esc(proposed.summary)}</p>${proposed.sections.map(s=>`<div class="wb-ai-synthesis-section"><strong>${esc(s.title)}</strong><p>${esc(s.description).replace(/\n/g,'<br>')}</p></div>`).join('')}<p>Les ${proposed.photos.length} photos restent comptabilisées, y compris celles retirées. Si des opérations sont fusionnées, les galeries sont réunies en conservant l’ordre relatif choisi dans chaque galerie. Les vues de baie moteur sans stade avant/après certain restent à classer.</p>${reconfirmEmpty?'<p class="wb-ai-warning">Des opérations ont changé : les choix « conserver sans photo » concernés devront être confirmés à nouveau après application.</p>':''}<div class="wb-ai-actions"><button type="button" class="btn" id="aiAcceptSynthesis">Appliquer cette proposition</button><button type="button" class="btn ghost" id="aiRejectSynthesis">Garder mes textes et mon classement</button></div>`;
      $('aiRejectSynthesis').onclick=()=>{panel.hidden=true;status('Proposition non appliquée. Ton classement est inchangé.');};
      $('aiAcceptSynthesis').onclick=()=>{
        if(JSON.stringify(plan)!==original){status('Tu as modifié le classement depuis cette proposition. Elle n’est pas appliquée pour préserver tes corrections.','error');return;}
        checkpointReview();plan=proposed;panel.hidden=true;renderReview();persistReview();status('Synthèse appliquée. Vérifie les éventuelles photos de baie moteur à préciser. Le dernier changement peut être annulé.');
      };
      panel.scrollIntoView({block:'start'});status('Synthèse prête, non appliquée : relis la proposition puis choisis de la conserver ou non.');
    }catch(e){synthesisRetry=true;status('Synthèse non appliquée : '+e.message+'. Ton classement reste ouvert pendant cette session.','error');}
    finally{setBusy(false);}
  };
  $('aiFixProblems').onclick=()=>{(recoveryIssues.some(x=>!x.resolved)?$('aiRecoveryIssues'):$('aiProblems')).scrollIntoView({block:'center'});};
  $('aiUndo').onclick=()=>{if(busy||!reviewUndo.length)return;const old=JSON.parse(reviewUndo.pop());plan=old.plan||old;recoveryIssues=old.recoveryIssues||[];$('aiSectionAction').hidden=true;refreshReview();$('aiSummary').value=plan.summary;$('aiUndo').disabled=!reviewUndo.length;};
  $('aiSummaryFromSections').onclick=()=>{
    if(busy||!plan||!confirm('Remplacer le résumé par les intitulés des opérations conservées et le bloc baie moteur présent ? Aucune analyse IA ne sera relancée.'))return;
    checkpointReview();plan.summary=C.summaryFromSections(plan);$('aiSummary').value=plan.summary;resetApproval();
  };
  $('aiApply').onclick=apply;
  window.addEventListener('beforeunload',e=>{if(dialog.open&&(busy||jobId||assets.length||documents.length||$('aiNotes').value.trim())){e.preventDefault();e.returnValue='';}});
  ['btnHomeAI','btnArchiveAI'].forEach(name=>{const b=document.getElementById(name);if(b){b.addEventListener('click',()=>{H.closeArchive();open();});H.ready.then(()=>b.disabled=false);}});
  } catch(error) {
    window.WBReportAIBootError=String(error?.message||error);
    console.error('WheelerBrothers : initialisation du module IA impossible',error);
    window.dispatchEvent(new Event('wb-ai-boot-failed'));
  }
})();
