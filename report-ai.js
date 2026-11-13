/* WheelerBrothers 56.4 — préparation volontaire, relecture obligatoire, nouveau rapport uniquement. */
(function(){
  'use strict';
  const C=window.WBReportAICore,H=window.WBReportAIHost,CFG=window.WB_REPORT_AI_CONFIG;
  if(!C || !H || !CFG?.enabled)return;
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
    <div id="aiResume" class="wb-ai-resume" hidden>Une préparation précédente est disponible. Si le transfert a été interrompu avant l'analyse, sélectionne de nouveau les mêmes fichiers : ceux déjà envoyés ne seront pas renvoyés.<div class="wb-ai-actions"><button class="btn" id="aiResumeBtn" type="button">Reprendre (lots restants potentiellement facturables)</button><button class="btn ghost" id="aiForget" type="button">Abandonner ce brouillon</button></div></div>
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
      <label class="wb-ai-check"><input type="checkbox" id="aiConsent"><span>J’autorise l’envoi de ces photos, factures PDF et notes à OpenAI pour préparer ce rapport. Plusieurs appels API facturables peuvent être nécessaires (un par lot) lorsque je cliquerai sur « Préparer le rapport ».</span></label>
      <div class="wb-ai-actions"><button type="button" class="btn primary" id="aiGenerate">Préparer le rapport</button></div>
    </section>
    <div id="aiStatus" class="wb-ai-status" role="status" aria-live="polite"></div>
    <div class="wb-ai-actions" id="aiRetryArea" hidden><button class="btn" type="button" id="aiRetry">Réessayer (nouvel appel API)</button><button class="btn ghost" type="button" id="aiRefresh">Vérifier le résultat existant</button></div>
    <div class="wb-ai-actions"><button type="button" class="btn ghost" id="aiDiscard" hidden>Abandonner ce brouillon</button></div><section id="aiReview" hidden><h3>Relire le classement</h3><p class="wb-ai-muted">Corrige les titres et affectations. Pour déplacer une photo du chapitre A vers D, utilise la liste « Affectation » sous la miniature (avec choix gauche/droite), puis les flèches ‹ et › pour régler son ordre dans le chapitre cible. « Ne pas inclure » est un choix explicite, jamais automatique.</p>
      <label for="aiSummary">Résumé</label><textarea id="aiSummary" maxlength="1600"></textarea>
      <div id="aiSections"></div><label class="filebtn btn ghost" for="aiExtraFiles">Ajouter des photos manquantes (sans nouvel appel IA)</label><input id="aiExtraFiles" type="file" accept="image/*" multiple><div id="aiReviewGallery" class="wb-ai-review-groups"></div><p id="aiPhotoOrderStatus" class="wb-ai-sr-only" role="status" aria-live="polite"></p>
      <div id="aiInvoiceReview" class="wb-ai-muted"></div><div id="aiWarnings" class="wb-ai-warnings"></div><div id="aiProblems" class="wb-ai-problems" role="status"></div><p id="aiUsage" class="wb-ai-usage"></p>
      <label class="wb-ai-check"><input type="checkbox" id="aiApprove"><span>J’ai relu les informations et le classement des photos. Créer le rapport ; si une intervention est sélectionnée, y rattacher le document sans la terminer ni le partager.</span></label>
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
    $('aiReview').querySelectorAll('.wb-ai-photo-move').forEach(el=>el.disabled=value||el.dataset.boundary==='true');
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
    try{localStorage.setItem(KEY,JSON.stringify({jobId,workflowRef,review:{plan,assets:assets.map(a=>({id:a.id,name:a.name,ext:a.ext})),usage}}));}catch(e){status('Le classement reste ouvert, mais les corrections ne peuvent pas être conservées localement.','error');}
  }
  function resetApproval(){$('aiApprove').checked=false;updateProblems();persistReview();}
  function updateProblems(){
    if(!plan){$('aiApply').disabled=true;return;}
    const problems=C.reviewProblems(plan);
    $('aiProblems').hidden=!problems.length;
    $('aiProblems').textContent=problems.length?'À corriger avant de créer le rapport :\n'+problems.join('\n'):'';
    $('aiApply').disabled=busy||problems.length>0||!$('aiApprove').checked;
  }
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
  function moveReviewPhoto(photoId,step){
    if(busy||!plan)return;
    const photo=plan.photos.find(p=>p.id===photoId);if(!photo)return;
    const photos=reviewPhotos(entryValue(photo)),from=photos.indexOf(photo),to=from+step;
    if(to<0||to>=photos.length)return;
    [photos[from],photos[to]]=[photos[to],photos[from]];
    // Renumber the gallery rather than swapping equal order values. Other
    // galleries and their assignments are untouched.
    photos.forEach((p,i)=>p.order=i);
    renderReviewPhotos();resetApproval();
    focusReviewPhoto(photoId,`.wb-ai-photo-move[data-step="${step}"]:not(:disabled)`);
    const name=assets.find(a=>a.id===photoId)?.name||'Photo';
    $('aiPhotoOrderStatus').textContent=`${name} : position ${to+1} sur ${photos.length}.`;
  }
  function renderReviewPhotos(){
    const opts=options(),assetById=new Map(assets.map(a=>[a.id,a]));
    $('aiReviewGallery').innerHTML=reviewGroups().map(group=>`<section class="wb-ai-photo-group" data-photo-group="${esc(group.target)}" aria-label="${esc(group.title)}"><h4>${esc(group.title)}</h4><div class="wb-ai-gallery">${group.photos.map((p,i)=>{
      const a=assetById.get(p.id);
      const arrow=(step,boundary)=>`<button type="button" class="btn ghost wb-ai-photo-move" data-step="${step}" data-boundary="${boundary}" title="${step<0?'Déplacer avant':'Déplacer après'}" aria-label="${step<0?'Avancer':'Reculer'} ${esc(a.name)} d’une place"${busy||boundary?' disabled':''}>${step<0?'‹':'›'}</button>`;
      return `<div class="wb-ai-tile" data-photo="${esc(p.id)}" data-unassigned="${p.kind==='unassigned'}"><div class="wb-ai-photo-tools">${arrow(-1,i===0)}<span class="wb-ai-photo-position" aria-label="Photo ${i+1} sur ${group.photos.length}">${i+1} / ${group.photos.length}</span>${arrow(1,i===group.photos.length-1)}</div><a href="${esc(a.url)}" target="_blank" rel="noopener"><img src="${esc(a.preview||a.url)}" loading="lazy" alt="${esc(a.name)}"></a><div class="wb-ai-name">${esc(a.name)}</div><select class="wb-ai-target" aria-label="Affectation de ${esc(a.name)}"${busy?' disabled':''}>${opts}</select><div class="wb-ai-reason">${esc(p.reason)}</div><label>Légende (facultative)<textarea class="wb-ai-cap" maxlength="350"${busy?' disabled':''}>${esc(p.caption)}</textarea></label></div>`;
    }).join('')}</div></section>`).join('');
    $('aiReviewGallery').querySelectorAll('[data-photo]').forEach(tile=>{
      const p=plan.photos.find(p=>p.id===tile.dataset.photo),select=tile.querySelector('.wb-ai-target');select.value=entryValue(p);
      select.onchange=()=>{
        if(busy)return;
        const parts=select.value.split('|');p.kind=parts[0];p.sectionId=parts[1]||'';p.side=parts[2]||'';p.reason='';
        const destination=reviewPhotos(entryValue(p)).filter(photo=>photo!==p);
        destination.push(p);destination.forEach((photo,i)=>photo.order=i);
        renderReviewPhotos();resetApproval();focusReviewPhoto(p.id,'.wb-ai-target');
      };
      tile.querySelectorAll('.wb-ai-photo-move').forEach(button=>button.onclick=()=>moveReviewPhoto(p.id,Number(button.dataset.step)));
      tile.querySelector('.wb-ai-cap').oninput=e=>{p.caption=e.target.value;resetApproval();};
    });
  }
  function renderReview(){
    $('aiInput').hidden=true;$('aiReview').hidden=false;$('aiResume').hidden=true;$('aiRetryArea').hidden=true;
    $('aiSummary').value=plan.summary;
    $('aiSections').innerHTML=plan.sections.map((s,i)=>`<div class="wb-ai-section" data-section="${s.id}"><label>${i+1}. Titre<input class="ai-stitle" maxlength="160" value="${esc(s.title)}"></label><label>Références / description<textarea class="ai-sdesc" maxlength="1600">${esc(s.description)}</textarea></label><label>Présentation<select class="ai-stype"><option value="normal">Simple</option><option value="sym">Gauche / droite</option></select></label></div>`).join('');
    $('aiSections').querySelectorAll('[data-section]').forEach(card=>{
      const s=plan.sections.find(s=>s.id===card.dataset.section);card.querySelector('.ai-stype').value=s.type;
      card.querySelector('.ai-stitle').oninput=e=>{s.title=e.target.value;renderReviewPhotos();resetApproval();};
      card.querySelector('.ai-sdesc').oninput=e=>{s.description=e.target.value;resetApproval();};
      card.querySelector('.ai-stype').onchange=e=>{s.type=e.target.value;plan.photos.filter(p=>p.sectionId===s.id).forEach(p=>{p.side='';if(s.type==='sym'){p.kind='unassigned';p.reason='Choisir le côté gauche ou droit.';}});renderReviewPhotos();resetApproval();};
    });
    renderReviewPhotos();
    $('aiInvoiceReview').textContent=documents.length?'Factures jointes automatiquement en fin de rapport : '+documents.map(d=>d.name+' ('+d.pages.length+' pages)').join(' ; '):'';
    $('aiWarnings').textContent=plan.warnings.length?'Points à vérifier (non imprimés) :\n'+plan.warnings.join('\n'):'';
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
        const excluded=new Set(local.photos.filter(p=>p.kind==='excluded').map(p=>p.id));
        local.photos.forEach(p=>{if(p.kind==='excluded')p.kind='unassigned';});
        plan=C.normalizePlan(local,assets);
        plan.photos.forEach(p=>{if(excluded.has(p.id))p.kind='excluded';});
      }else plan=C.normalizePlan(result.plan,assets);
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
      status(`Analyse IA par lots : ${done} / ${total} photos — ${result.doneBatches} / ${result.totalBatches} lot(s) terminés. Les lots précédents sont conservés.`);
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
    if(retry && !confirm('Relancer UNIQUEMENT le lot en échec ? Ce nouvel appel peut consommer du crédit API. Les lots réussis sont conservés.'))return;
    setBusy(true);
    try{
      if(!retry){
        status('Vérification du service IA… Aucun appel OpenAI.');const caps=await call('capabilities');
        if(caps.version!=='56.3'||caps.mode!=='batches')throw new Error('Serveur IA v56.3 requis. Déploie wbReportAI v56.3 avant de traiter les photos originales.');
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
    assets.forEach(a=>{if(a.preview)URL.revokeObjectURL(a.preview);});assets=[];documents=[];vehicleKm=null;vehiclePlate='';rejectedFiles.clear();renderDocuments();plan=null;jobId='';requestInput=null;usage=null;workflowRef=null;workflowOptions=[];renderWorkflowOptions();
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
  $('aiApply').onclick=apply;
  window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
  ['btnHomeAI','btnArchiveAI'].forEach(name=>{const b=document.getElementById(name);if(b){b.addEventListener('click',()=>{H.closeArchive();open();});H.ready.then(()=>b.disabled=false);}});
})();
