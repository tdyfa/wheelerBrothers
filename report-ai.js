/* WheelerBrothers 54 — préparation volontaire, relecture obligatoire, nouveau rapport uniquement. */
(function(){
  'use strict';
  const C=window.WBReportAICore,H=window.WBReportAIHost,CFG=window.WB_REPORT_AI_CONFIG;
  if(!C || !H || !CFG?.enabled)return;
  const KEY='wb_ai_pending_v1';
  const LIMIT=Math.min(C.MAX_IMAGES,CFG.maxImages||100);
  const id=(prefix,n)=>prefix+Array.from(crypto.getRandomValues(new Uint8Array(n))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let assets=[],documents=[],plan=null,jobId='',busy=false,requestInput=null,usage=null,vehicleKm=null,vehiclePlate='';
  const dialog=document.createElement('dialog');dialog.className='wb-ai-dialog no-print';dialog.id='wbAiDialog';
  dialog.setAttribute('aria-labelledby','aiTitle');
  const checks=H.blank().checkpoints;
  dialog.innerHTML=`<header class="wb-ai-head"><h2 id="aiTitle">Créer un rapport avec l’IA</h2><button type="button" class="btn ghost" id="aiClose" aria-label="Fermer">✕</button></header>
    <div class="wb-ai-body"><p class="wb-ai-notice">Ajoute tes photos et décris les travaux. L’IA propose un classement ; tu le relis avant de créer un <strong>nouveau</strong> rapport. Aucun ancien rapport ni carnet client n’est modifié.</p>
    <div id="aiResume" class="wb-ai-resume" hidden>Une préparation précédente est disponible.<div class="wb-ai-actions"><button class="btn" id="aiResumeBtn" type="button">Reprendre la préparation</button><button class="btn ghost" id="aiForget" type="button">Abandonner ce brouillon</button></div></div>
    <section id="aiInput">
      <div class="wb-ai-grid">
        <div><label for="aiPlate">Immatriculation</label><div class="wb-ai-plate"><input id="aiPlate" maxlength="160" autocapitalize="characters" placeholder="FL-656-AC"><button class="btn ghost" type="button" id="aiVerify">Vérifier</button></div><label class="wb-ai-check wb-ai-other"><input type="checkbox" id="aiPlateOther"><span>Autre format</span></label><p id="aiVehicleStatus" class="wb-ai-muted" role="status"></p></div>
        <div><label for="aiKm">Kilométrage</label><input id="aiKm" inputmode="numeric" maxlength="160" placeholder="65 000"></div>
        <div><label for="aiBrand">Marque</label><input id="aiBrand" maxlength="160" placeholder="Audi"></div>
        <div><label for="aiModel">Modèle</label><input id="aiModel" maxlength="160" placeholder="RS3"></div>
        <div><label for="aiDate">Date d’intervention</label><input id="aiDate" type="date"></div>
      </div>
      <div class="wb-ai-grid"><div><label for="aiEngine">Motorisation</label><input id="aiEngine" maxlength="160"></div><div><label for="aiReg">1ère mise en circulation</label><input id="aiReg" placeholder="JJ/MM/AAAA" maxlength="160"></div></div>
      <p id="aiMileageStatus" class="wb-ai-muted">La recherche de fiche se déclenche uniquement avec « Vérifier ».</p>
      <label for="aiNotes">Travaux effectués, pièces et précisions *</label><textarea id="aiNotes" maxlength="12000" placeholder="Ex. : vidange moteur et remplacement du filtre à huile ; nettoyage du filtre à air réutilisable. Préciser les côtés ou les références si nécessaire."></textarea>
      <h3>Photos de l’intervention</h3><p class="wb-ai-muted">Jusqu’à ${LIMIT} images, en une ou plusieurs sélections. Les fichiers sont préparés un par un pour limiter la mémoire du téléphone. Factures PDF : ajout possible ensuite dans l’éditeur habituel.</p>
      <label class="filebtn btn" for="aiFiles">Ajouter des photos</label><input id="aiFiles" type="file" accept="image/*" multiple>
      <p id="aiCount" class="wb-ai-muted">Aucune photo sélectionnée.</p><div id="aiGallery" class="wb-ai-gallery"></div>
      <h3>Factures PDF</h3><p class="wb-ai-muted">Les PDF sont analysés pour relever les références des pièces et toutes leurs pages sont ajoutées en fin de rapport, dans l’ordre de sélection. Maximum 3 PDF, 8 Mio chacun et 20 pages au total. Vérifie les références avant validation.</p>
      <label class="filebtn btn" for="aiPdfFiles">Ajouter des factures PDF</label><input id="aiPdfFiles" type="file" accept="application/pdf,.pdf" multiple><div id="aiPdfList" class="wb-ai-muted"></div>
      <details><summary>Contrôles confirmés et recommandations (facultatif)</summary><p class="wb-ai-muted">Cocher seulement les contrôles réellement effectués. L’IA ne coche rien automatiquement.</p>
      ${checks.map((cp,i)=>`<label class="wb-ai-check"><input type="checkbox" id="aiCp${i}"><span>${esc(cp.label)}</span></label>`).join('')}
      <label for="aiClosing">Recommandations / prochaine révision</label><textarea id="aiClosing" maxlength="2000" placeholder="Reprendre uniquement les recommandations et échéances que tu confirmes."></textarea></details>
      <label class="wb-ai-check"><input type="checkbox" id="aiConsent"><span>J’autorise l’envoi de ces photos, factures PDF et notes à OpenAI pour préparer ce rapport. Un appel API facturable sera effectué lorsque je cliquerai sur « Préparer le rapport ».</span></label>
      <div class="wb-ai-actions"><button type="button" class="btn primary" id="aiGenerate">Préparer le rapport</button></div>
    </section>
    <div id="aiStatus" class="wb-ai-status" role="status" aria-live="polite"></div>
    <div class="wb-ai-actions" id="aiRetryArea" hidden><button class="btn" type="button" id="aiRetry">Réessayer (nouvel appel API)</button><button class="btn ghost" type="button" id="aiRefresh">Vérifier le résultat existant</button></div>
    <div class="wb-ai-actions"><button type="button" class="btn ghost" id="aiDiscard" hidden>Abandonner ce brouillon</button></div><section id="aiReview" hidden><h3>Relire le classement</h3><p class="wb-ai-muted">Corrige les titres et affectations. L’ordre numérique classe les photos au sein de chaque galerie. « Ne pas inclure » est un choix explicite, jamais automatique.</p>
      <label for="aiSummary">Résumé</label><textarea id="aiSummary" maxlength="1600"></textarea>
      <div id="aiSections"></div><label class="filebtn btn ghost" for="aiExtraFiles">Ajouter des photos manquantes (sans nouvel appel IA)</label><input id="aiExtraFiles" type="file" accept="image/*" multiple><div id="aiReviewGallery" class="wb-ai-gallery"></div>
      <div id="aiInvoiceReview" class="wb-ai-muted"></div><div id="aiWarnings" class="wb-ai-warnings"></div><div id="aiProblems" class="wb-ai-problems" role="status"></div><p id="aiUsage" class="wb-ai-usage"></p>
      <label class="wb-ai-check"><input type="checkbox" id="aiApprove"><span>J’ai relu les informations et le classement des photos. Créer le rapport sans mise à jour du carnet ni partage client.</span></label>
      <div class="wb-ai-actions"><button class="btn primary" type="button" id="aiApply" disabled>Créer le rapport dans l’éditeur</button></div>
    </section></div>`;
  document.body.appendChild(dialog);
  const $=name=>dialog.querySelector('#'+name);
  function status(message,kind=''){ $('aiStatus').textContent=message;$('aiStatus').dataset.kind=kind; }
  function remember(){$('aiDiscard').hidden=!jobId;try{localStorage.setItem(KEY,JSON.stringify({jobId}));}catch(e){/* reprise non disponible si stockage local interdit */}}
  function remembered(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){return null;}}
  function forget(){try{localStorage.removeItem(KEY);}catch(e){}$('aiResume').hidden=true;}
  function setBusy(value){
    busy=value;
    ['aiClose','aiGenerate','aiFiles','aiPdfFiles','aiVerify','aiRetry','aiRefresh','aiResumeBtn','aiForget','aiDiscard','aiApply'].forEach(k=>{$(k).disabled=value;});
    $('aiInput').querySelectorAll('input,textarea').forEach(el=>el.disabled=value);
    $('aiReview').querySelectorAll('input,textarea,select').forEach(el=>el.disabled=value);
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
  $('aiPlate').addEventListener('input',()=>{WBVehicleInput.formatPlate($('aiPlate'),$('aiPlateOther').checked);vehicleKm=null;vehiclePlate='';$('aiVehicleStatus').textContent='';checkKm();});
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
      vehicleKm=result.km?.km??null;vehiclePlate=key;checkKm();
      $('aiVehicleStatus').textContent='Fiche trouvée. Les champs disponibles ont été complétés.'+(info.inferred?' Vérifie la marque et le modèle déduits.':'');
    }catch(e){$('aiVehicleStatus').textContent='Recherche indisponible : '+e.message;}
    finally{$('aiVerify').disabled=false;}
  };
  function renderDocuments(){
    $('aiPdfList').innerHTML=documents.map(d=>`<div class="wb-ai-document">📄 ${esc(d.name)} — ${d.pages.length} page(s) <button type="button" class="btn ghost" data-pdf-remove="${d.id}">Retirer</button></div>`).join('');
    $('aiPdfList').querySelectorAll('[data-pdf-remove]').forEach(b=>b.onclick=()=>{if(busy||jobId)return;documents=documents.filter(d=>d.id!==b.dataset.pdfRemove);renderDocuments();});
  }
  $('aiPdfFiles').addEventListener('change',async e=>{
    const files=[...e.target.files];e.target.value='';if(busy||jobId)return;setBusy(true);const errors=[];
    try{for(const f of files){
      try{
        if(documents.length>=3)throw new Error('Maximum 3 factures PDF');
        if(f.size>8*1024*1024||f.size<8||!(/\.pdf$/i.test(f.name)))throw new Error('PDF invalide ou supérieur à 8 Mio');
        const bytes=new Uint8Array(await f.slice(0,5).arrayBuffer());if(String.fromCharCode(...bytes)!=='%PDF-')throw new Error('En-tête PDF invalide');
        status('Conversion locale des pages de '+f.name+'…');
        const images=await H.pdfPages(f,1.35);
        if(!images.length||images.length+documents.reduce((n,d)=>n+d.pages.length,0)>20)throw new Error('Maximum 20 pages de factures au total');
        const pages=[];
        for(const data of images){const blob=await (await fetch(data)).blob();if(blob.size>2*1024*1024)throw new Error('Page PDF trop volumineuse');pages.push({id:id('a',12),blob});}
        documents.push({id:id('d',12),name:f.name.slice(0,160),blob:f,pages});
      }catch(err){errors.push(f.name+' : '+err.message);}
    }}finally{setBusy(false);renderDocuments();status(errors.length?errors.join('\n'):'Factures préparées localement. Elles seront analysées avec les photos.',errors.length?'error':'');}
  });
  async function compress(file){
    if(file.size>45*1024*1024)throw new Error('Fichier supérieur à 45 Mio');
    let image,url;
    try{
      try{image=await createImageBitmap(file,{imageOrientation:'from-image'});}
      catch(e){
        url=URL.createObjectURL(file);
        image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Format non décodé sur cet appareil ; exporter en JPEG/PNG'));img.src=url;});
      }
      const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight;
      if(!w||!h)throw new Error('Dimensions invalides');
      const scale=Math.min(1,1600/Math.max(w,h)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      let blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.82));
      if(blob && blob.size>950000)blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.65));
      canvas.width=canvas.height=1;
      if(!blob || blob.type!=='image/jpeg' || blob.size>2*1024*1024)throw new Error('Image trop volumineuse après compression');
      return blob;
    }finally{if(image?.close)image.close();if(url)URL.revokeObjectURL(url);}
  }
  function renderInputPhotos(){
    const total=assets.reduce((n,a)=>n+(a.blob?.size||0),0);
    $('aiCount').textContent=`${assets.length} / ${LIMIT} photos — ${(total/1024/1024).toFixed(1)} Mio préparés (maximum 30 Mio).`;
    $('aiGallery').innerHTML=assets.map(a=>`<div class="wb-ai-tile"><img src="${esc(a.preview||a.url)}" alt="${esc(a.name)}" loading="lazy"><div class="wb-ai-name">${esc(a.name)}</div><button class="btn ghost" type="button" data-remove="${a.id}">Retirer</button></div>`).join('');
    $('aiGallery').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{
      if(busy||jobId)return;
      const a=assets.find(a=>a.id===b.dataset.remove);if(a?.preview)URL.revokeObjectURL(a.preview);
      assets=assets.filter(a=>a.id!==b.dataset.remove);renderInputPhotos();
    });
  }
  $('aiFiles').addEventListener('change',async e=>{
    if(busy||jobId)return;
    const files=[...e.target.files];e.target.value='';setBusy(true);const errors=[];
    try{
      for(let i=0;i<files.length;i++){
        if(assets.length>=LIMIT){errors.push('Limite de '+LIMIT+' images atteinte. Les suivantes n’ont pas été ajoutées.');break;}
        const f=files[i];status(`Préparation locale de la photo ${i+1} / ${files.length}… Aucun appel IA.`);
        try{
          const blob=await compress(f);
          const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('');
          if(assets.some(a=>a.hash===hash)){errors.push(f.name+' : doublon exact non ajouté.');continue;}
          if(assets.reduce((n,a)=>n+(a.blob?.size||0),0)+blob.size>30*1024*1024){errors.push(f.name+' : lot de 30 Mio atteint.');continue;}
          assets.push({id:id('a',12),name:f.name.slice(0,200),blob,hash,preview:URL.createObjectURL(blob)});
        }catch(err){errors.push(f.name+' : '+err.message);}
      }
    }finally{setBusy(false);renderInputPhotos();status(errors.length?errors.join('\n'):'Photos prêtes. Tu peux en ajouter d’autres avant de lancer la préparation.',errors.length?'error':'');}
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
  async function upload(){
    const space=H.space();
    for(let i=0;i<assets.length;i++){
      const a=assets[i];if(a.url)continue;
      status(`Envoi sécurisé des photos : ${i+1} / ${assets.length}… Aucun appel IA à ce stade.`);
      const path=`spaces/${space}/reports/${jobId}/ai-${a.id}.jpg`;
      const ref=H.storage().ref().child(path);
      await ref.put(a.blob,{contentType:'image/jpeg',cacheControl:'private,max-age=3600'});
      a.url=await ref.getDownloadURL();
    }
    for(const d of documents){
      if(!d.uploaded){status('Envoi sécurisé de la facture '+d.name+'…');await H.storage().ref().child(`spaces/${space}/reports/${jobId}/ai-doc-${d.id}.pdf`).put(d.blob,{contentType:'application/pdf'});d.uploaded=true;}
      for(const page of d.pages){if(page.url)continue;const ref=H.storage().ref().child(`spaces/${space}/reports/${jobId}/ai-inv-${page.id}.jpg`);await ref.put(page.blob,{contentType:'image/jpeg'});page.url=await ref.getDownloadURL();}
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
    try{localStorage.setItem(KEY,JSON.stringify({jobId,review:{plan,assets:assets.map(a=>({id:a.id,name:a.name})),usage}}));}catch(e){status('Le classement reste ouvert, mais les corrections ne peuvent pas être conservées localement.','error');}
  }
  function resetApproval(){$('aiApprove').checked=false;updateProblems();persistReview();}
  function updateProblems(){
    if(!plan){$('aiApply').disabled=true;return;}
    const problems=C.reviewProblems(plan);
    $('aiProblems').hidden=!problems.length;
    $('aiProblems').textContent=problems.length?'À corriger avant de créer le rapport :\n'+problems.join('\n'):'';
    $('aiApply').disabled=busy||problems.length>0||!$('aiApprove').checked;
  }
  function renderReviewPhotos(){
    const opts=options();
    $('aiReviewGallery').innerHTML=plan.photos.map(p=>{
      const a=assets.find(a=>a.id===p.id);
      return `<div class="wb-ai-tile" data-photo="${p.id}" data-unassigned="${p.kind==='unassigned'}"><a href="${esc(a.url)}" target="_blank" rel="noopener"><img src="${esc(a.preview||a.url)}" loading="lazy" alt="${esc(a.name)}"></a><div class="wb-ai-name">${esc(a.name)}</div><select class="wb-ai-target" aria-label="Affectation de ${esc(a.name)}">${opts}</select><div class="wb-ai-reason">${esc(p.reason)}</div><label>Ordre<input class="wb-ai-order" type="number" min="0" max="10000" value="${p.order}"></label><label>Légende (facultative)<textarea class="wb-ai-cap" maxlength="350">${esc(p.caption)}</textarea></label></div>`;
    }).join('');
    $('aiReviewGallery').querySelectorAll('[data-photo]').forEach(tile=>{
      const p=plan.photos.find(p=>p.id===tile.dataset.photo),select=tile.querySelector('select');select.value=entryValue(p);
      select.onchange=()=>{const parts=select.value.split('|');p.kind=parts[0];p.sectionId=parts[1]||'';p.side=parts[2]||'';p.reason='';tile.querySelector('.wb-ai-reason').textContent='';tile.dataset.unassigned=String(p.kind==='unassigned');resetApproval();};
      tile.querySelector('.wb-ai-order').oninput=e=>{p.order=Math.max(0,Math.min(10000,Number(e.target.value)||0));resetApproval();};
      tile.querySelector('.wb-ai-cap').oninput=e=>{p.caption=e.target.value;resetApproval();};
    });
  }
  function renderReview(){
    $('aiInput').hidden=true;$('aiReview').hidden=false;$('aiResume').hidden=true;$('aiRetryArea').hidden=true;
    $('aiSummary').value=plan.summary;
    $('aiSections').innerHTML=plan.sections.map((s,i)=>`<div class="wb-ai-section" data-section="${s.id}"><label>${i+1}. Titre<input class="ai-stitle" maxlength="160" value="${esc(s.title)}"></label><label>Références / description<textarea class="ai-sdesc" maxlength="1600">${esc(s.description)}</textarea></label><label>Présentation<select class="ai-stype"><option value="normal">Simple</option><option value="sym">Gauche / droite</option></select></label></div>`).join('');
    $('aiSections').querySelectorAll('[data-section]').forEach(card=>{
      const s=plan.sections.find(s=>s.id===card.dataset.section);card.querySelector('.ai-stype').value=s.type;
      card.querySelector('.ai-stitle').oninput=e=>{s.title=e.target.value;resetApproval();};
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
      for(const a of assets){if(!a.url)a.url=await H.storage().ref().child(`spaces/${H.space()}/reports/${jobId}/ai-${a.id}.jpg`).getDownloadURL();}
      documents=(result.documents||[]).map(d=>({...d,pages:d.pages.map(page=>({...page,url:page.url||''}))}));
      for(const d of documents)for(const page of d.pages)if(!page.url)page.url=await H.storage().ref().child(`spaces/${H.space()}/reports/${jobId}/ai-inv-${page.id}.jpg`).getDownloadURL();
      requestInput={jobId,assets:result.assets,documents:result.documents||[],notes:result.notes,meta:result.meta,consent:true};
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
    if(result.status==='failed'){status(result.error||'Préparation interrompue.','error');return;}
    status('La préparation est encore en cours côté serveur. Le bouton « Vérifier le résultat existant » ne relance pas d’analyse IA.');
  }
  async function generate(retry=false){
    if(busy)return;
    if(!retry && !$('aiPlate').reportValidity())return;
    if(!retry && (jobId||remembered()?.jobId)){status('Une préparation est déjà ouverte. Reprends-la ou abandonne-la avant un nouvel envoi.','error');return;}
    if(!retry && (!assets.length || $('aiNotes').value.trim().length<10 || !$('aiConsent').checked)){
      status('Ajoute au moins une photo, décris les travaux et confirme l’envoi à OpenAI.','error');return;
    }
    if(retry && !confirm('Relancer l’analyse complète ? Ce nouvel appel peut consommer du crédit API, même si la tentative précédente a échoué.'))return;
    setBusy(true);
    try{
      if(!retry){
        status('Vérification du service IA… Aucun appel OpenAI.');await call('capabilities');
        jobId=id('rai',16);remember();await upload();
        requestInput={jobId,assets:assets.map(a=>({id:a.id,name:a.name})),documents:documents.map(d=>({id:d.id,name:d.name,pages:d.pages.map(p=>({id:p.id}))})),notes:$('aiNotes').value.trim(),meta:metaFromForm(),consent:true};
      }
      $('aiInput').hidden=true;status('Analyse et préparation du classement… L’appel API est en cours.');
      const result=await call('prepare',{...requestInput,retry});await consume(result);
    }catch(e){
      status(e.message+'\nNe relance pas immédiatement : vérifie d’abord le résultat existant.', 'error');
      if(jobId){$('aiRetryArea').hidden=false;$('aiRetry').hidden=true;$('aiResume').hidden=false;}
    }finally{setBusy(false);}
  }
  async function resume(){
    if(busy)return;const stored=remembered();if(!jobId && stored?.jobId)jobId=stored.jobId;if(!jobId)return;
    setBusy(true);status('Récupération du brouillon existant… Aucun nouvel appel IA.');
    try{await consume(await call('status',{jobId}),stored?.review||null);}catch(e){status(e.message,'error');}finally{setBusy(false);}
  }
  $('aiExtraFiles').addEventListener('change',async e=>{
    if(busy || !plan || !jobId)return;
    const selected=[...e.target.files];e.target.value='';const errors=[];setBusy(true);
    try{
      for(const file of selected){
        if(assets.length>=LIMIT){errors.push('Limite de '+LIMIT+' images atteinte.');break;}
        status('Ajout manuel de '+file.name+'… Aucun appel IA.');
        try{
          const blob=await compress(file),a={id:id('a',12),name:file.name.slice(0,200),blob};
          const ref=H.storage().ref().child(`spaces/${H.space()}/reports/${jobId}/ai-${a.id}.jpg`);
          await ref.put(blob,{contentType:'image/jpeg',cacheControl:'private,max-age=3600'});
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
    assets.forEach(a=>{if(a.preview)URL.revokeObjectURL(a.preview);});assets=[];documents=[];vehicleKm=null;vehiclePlate='';renderDocuments();plan=null;jobId='';requestInput=null;usage=null;
    $('aiDiscard').hidden=true;$('aiInput').hidden=false;$('aiReview').hidden=true;$('aiRetryArea').hidden=true;setMeta({});$('aiNotes').value='';$('aiConsent').checked=false;renderInputPhotos();setBusy(false);
  }
  async function abandon(){
    if(busy)return;const pending=remembered();const target=jobId||pending?.jobId;if(!target)return;
    if(!confirm('Abandonner ce brouillon et supprimer ses photos de préparation ? Aucun rapport déjà créé ne sera supprimé.'))return;
    setBusy(true);
    try{await call('discard',{jobId:target});forget();reset();status('Brouillon abandonné.');}
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
      await H.apply(report,jobId);
      forget();dialog.close();reset();
    }catch(e){status('Le rapport n’a pas pu être ouvert : '+e.message+'. Le brouillon est conservé.','error');}
    finally{setBusy(false);}
  }
  async function open(){
    await H.ready;
    if(!plan && !jobId){const previous=remembered();$('aiResume').hidden=!previous?.jobId;$('aiGenerate').disabled=Boolean(previous?.jobId);}
    dialog.showModal();
  }
  $('aiGenerate').onclick=()=>generate(false);$('aiRetry').onclick=()=>generate(true);$('aiRefresh').onclick=resume;
  $('aiResumeBtn').onclick=resume;$('aiForget').onclick=abandon;$('aiDiscard').onclick=abandon;
  $('aiClose').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('aiApprove').onchange=updateProblems;$('aiSummary').oninput=e=>{if(plan){plan.summary=e.target.value;resetApproval();}};
  $('aiApply').onclick=apply;
  window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
  ['btnHomeAI','btnArchiveAI'].forEach(name=>{const b=document.getElementById(name);if(b){b.addEventListener('click',()=>{H.closeArchive();open();});H.ready.then(()=>b.disabled=false);}});
})();
