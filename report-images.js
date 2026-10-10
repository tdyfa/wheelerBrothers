/* Atelier 52.3.1 — chargement et diagnostic des images, sans changement du PDF. */
const WBReportImages = (() => {
  const refreshed = new Map();
  const failure = (code, message, extra={}) => Object.assign(new Error(message), {code}, extra);
  async function bounded(promise, label) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer=setTimeout(()=>reject(failure('image-timeout', label)), 20000);
    })]); } finally { clearTimeout(timer); }
  }
  function sourceInfo(src) {
    if(typeof src!=='string') return 'Source de format invalide';
    if(src.startsWith('data:')) return 'Image intégrée au rapport';
    if(src.startsWith('blob:')) return 'Image locale temporaire';
    try {
      const url=new URL(src, location.href);
      const object=url.pathname.includes('/o/') ? url.pathname.split('/o/')[1] : url.pathname;
      return `${url.hostname} / ${decodeURIComponent(object)}`;
    } catch(_) { return 'Adresse invalide'; }
  }
  async function remoteBlob(url) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(url,{method:'GET',mode:'cors',cache:'no-store',credentials:'omit',signal:controller.signal});
      if(!response.ok) throw failure(
        response.status===404?'storage-object-not-found':
        [401,403].includes(response.status)?'storage-read-denied':'storage-download-http',
        `Téléchargement HTTP ${response.status}`, {httpStatus:response.status});
      const blob=await response.blob();
      if(!blob.size) throw failure('image-empty','Fichier vide');
      return blob;
    } catch(error) {
      if(typeof error.code==='string') throw error;
      throw failure(error.name==='AbortError'?'image-timeout':'image-network',
        error.name==='AbortError'?'Chargement trop long':'Lecture bloquée par le réseau, CORS ou le serveur');
    } finally { clearTimeout(timer); }
  }
  async function sourceAsBlob(src) {
    if(typeof src!=='string'||!src) throw failure('invalid-image-source','Source de photo absente ou invalide');
    if(src.startsWith('data:')||src.startsWith('blob:')) {
      try { return await remoteBlob(src); }
      catch(error) { throw failure(src.startsWith('blob:')?'image-local-expired':'image-embedded-invalid',
        src.startsWith('blob:')?'Lien local temporaire indisponible':'Image intégrée illisible'); }
    }
    let url;
    try { url=new URL(src,location.href); }
    catch(_) { throw failure('invalid-image-source','Adresse de photo invalide'); }
    if(!['http:','https:'].includes(url.protocol)) throw failure('invalid-image-source','Protocole de photo invalide');
    // Lire le lien enregistré, puis résoudre à nouveau l'objet avec la session
    // Atelier si nécessaire. Un 403 seul ne prouve pas un token révoqué.
    try { return await remoteBlob(src); }
    catch(original) {
      if(typeof storage!=='undefined' && storage && isFirebaseStorageDownloadUrl(src)) {
        let current;
        try { current=await bounded(storage.refFromURL(src).getDownloadURL(),'Résolution du lien Storage trop longue'); }
        catch(sdkError) {
          original.sdkCode=sdkError.code||'storage/unknown';
          if(sdkError.code==='storage/object-not-found') original.code='storage-object-not-found';
          throw original;
        }
        if(current && current!==src) {
          try {
            const blob=await remoteBlob(current);
            refreshed.set(src,current);
            return blob;
          } catch(currentError) { currentError.linkRefreshed=true; throw currentError; }
        }
      }
      throw original;
    }
  }
  async function decode(blob) {
    if(typeof createImageBitmap==='function') {
      try {
        const bitmap=await bounded(createImageBitmap(blob,{imageOrientation:'from-image'}),'Décodage trop long');
        if(bitmap.width&&bitmap.height) return bitmap;
        bitmap.close();
      } catch(_) { /* repli Image pour les formats pris en charge par le navigateur */ }
    }
    const url=URL.createObjectURL(blob);
    const img=new Image();
    try {
      return await bounded(new Promise((resolve,reject)=>{
        img.onload=()=>img.naturalWidth&&img.naturalHeight ? resolve(img) : reject(failure('image-decode','Dimensions nulles'));
        img.onerror=()=>reject(failure('image-decode','Décodage impossible'));
        img.src=url;
      }),'Décodage trop long');
    } catch(_) {
      throw failure('image-decode','Le fichier est reçu mais le navigateur ne peut pas le décoder', {mime:blob.type||'non indiqué',bytes:blob.size});
    } finally { img.onload=null;img.onerror=null;URL.revokeObjectURL(url); }
  }
  async function load(src,cache) {
    if(!src) return null;
    if(cache.has(src)) return cache.get(src);
    const promise=(async()=>{
      for(let attempt=0;attempt<2;attempt++) {
        try { return await decode(await sourceAsBlob(src)); }
        catch(error) {
          if(attempt===0 && (['image-network','image-timeout'].includes(error.code)||error.httpStatus>=500)) {
            await new Promise(resolve=>setTimeout(resolve,250)); continue;
          }
          throw error;
        }
      }
    })();
    cache.set(src,promise);
    try { return await promise; }
    catch(error) {
      // Une promesse rejetée ne doit jamais empêcher les prochaines tentatives.
      if(cache.get(src)===promise) cache.delete(src);
      const wrapped=failure(error.code||'report-image-load-failed',error.message,
        {source:sourceInfo(src),httpStatus:error.httpStatus,sdkCode:error.sdkCode,mime:error.mime,bytes:error.bytes,linkRefreshed:error.linkRefreshed});
      wrapped.imageLocations=entries().filter(entry=>entry.src===src).map(publicEntry);
      throw wrapped;
    }
  }
  function entries() {
    const s=state, list=[];
    const field=(key,label)=>{if(s[key])list.push({src:s[key],path:key,label,field:key});};
    field('logo','Logo WheelerBrothers');
    // Le moteur prend le logo par défaut si aucun logo n'est enregistré.
    if(!s.logo)list.push({src:DEFAULT_LOGO,path:'logo',label:'Logo WheelerBrothers par défaut'});
    field('overview',"Vue d’ensemble du véhicule");field('products','Produits / pièces utilisés');
    (s.sections||[]).forEach((sec,i)=>{
      const keys=sec.type==='sym'?['photosL','photosR']:['photos'];
      keys.forEach(key=>(sec[key]||[]).forEach((item,j)=>{
        const cols=key==='photos'?Math.max(1,Math.min(6,Number(sec.cols)||2)):1;
        const side=key==='photosL'?` — ${sec.labelL||'Gauche'}`:key==='photosR'?` — ${sec.labelR||'Droite'}`:'';
        list.push({src:item.src,path:`sections[${i}].${key}[${j}].src`,
          label:`Prestation ${i+1} « ${sec.title||'Sans titre'} »${side} — photo ${j+1} (ligne ${Math.floor(j/cols)+1}${key==='photos'?`, colonne ${j%cols+1}`:''})`,
          id:item.id,caption:item.cap,item,section:sec,arrayKey:key});
      }));
    });
    field('labelR','Étiquette — recto');field('labelV','Étiquette — verso');
    if(s.baieOn){field('baieAvant','Baie moteur — avant');field('baieApres','Baie moteur — après');}
    if(s.invoicesOn)(s.invoices||[]).forEach((item,i)=>{
      if(item.kind!=='pdf')list.push({src:item.src,path:`invoices[${i}].src`,label:`Facture ${i+1} « ${item.name||'Sans nom'} »`,id:item.id,item,arrayKey:'invoices'});
    });
    return list;
  }
  function publicEntry(entry) {
    return {position:entry.path,description:entry.label,id:entry.id,legende:entry.caption,fichier:sourceInfo(entry.src)};
  }
  function explain(error) {
    let text;
    switch(error.code) {
      case 'storage-object-not-found': text='Objet Storage introuvable (404 ou storage/object-not-found). Vérifier le chemin et réimporter le fichier original s’il a été supprimé.';break;
      case 'storage-read-denied': text=`Accès refusé (HTTP ${error.httpStatus||'401/403'}). Le lien peut avoir été invalidé, ou l’accès au fichier être bloqué. Réessayer avec la session Atelier connectée ; ce statut seul ne permet pas de trancher.`;break;
      case 'image-decode': text=`Fichier reçu, mais image illisible : fichier corrompu ou format non pris en charge (${error.mime}, ${error.bytes} octets). Réimporter en JPG/PNG ou réimporter la facture PDF originale.`;break;
      case 'image-empty': text='Le fichier reçu est vide. Réimporter l’original.';break;
      case 'image-local-expired': text='URL locale temporaire devenue indisponible. Réimporter l’image originale.';break;
      case 'image-embedded-invalid': text='Image intégrée invalide ou tronquée. Réimporter l’original.';break;
      case 'invalid-image-source': text='La référence de cette image est absente ou invalide. Réimporter l’original.';break;
      case 'image-timeout': text='Délai de chargement dépassé. Réessayer.';break;
      case 'image-network': text='Le navigateur ne peut pas lire la réponse : réseau, CORS ou serveur. Aucun statut HTTP observable ; ne pas conclure à un 403 ou à une image corrompue.';break;
      default: text=`Chargement impossible (${error.code||'erreur inconnue'}${error.httpStatus?`, HTTP ${error.httpStatus}`:''}).`;
    }
    if(error.sdkCode)text+=` Résolution Storage : ${error.sdkCode}.`;
    if(error.linkRefreshed)text+=' Un lien actuel a été obtenu, mais son téléchargement a également échoué.';
    return text;
  }
  function message(error) {
    if(!error.imageLocations) return `Génération A4 impossible : ${error.message||'erreur inconnue'}`;
    return error.imageLocations.map(x=>`${x.description}\nPosition : ${x.position}${x.id?` — ID : ${x.id}`:''}\nFichier : ${x.fichier}`).join('\n\n')+'\n\n'+explain(error);
  }
  function previewError(error) {
    const report=document.getElementById('report');
    report.replaceChildren();
    const box=document.createElement('div');box.className='pdf-preview-message';
    box.style.cssText='display:block;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere';
    box.textContent=message(error)+'\n\nUtilise « Vérifier les photos » pour contrôler toutes les images, ou « Réessayer ».';
    report.appendChild(box);
  }
  function stillCurrent(entry,reportId) {
    return currentReportId===reportId && entries().some(e=>e.path===entry.path && e.src===entry.src && e.item===entry.item && e.field===entry.field);
  }
  function commit(entry,src) {
    if(entry.field)state[entry.field]=src;else entry.item.src=src;
    buildSections();buildBaie();buildChecklist();buildInvoices();renderReport(true);save();
  }
  async function replace(entry,reportId,file) {
    if(!reportId||!stillCurrent(entry,reportId))throw new Error('Le rapport ou la photo a changé. Relancer le diagnostic.');
    let data;
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)) {
      if(entry.arrayKey!=='invoices')throw new Error('Choisir une image JPG ou PNG pour cette photo.');
      const pages=await pdfToImages(file);
      if(pages.length!==1)throw new Error('Ce PDF contient plusieurs pages. Utiliser « Ajouter une ou plusieurs factures » pour l’importer, puis retirer l’ancienne référence en erreur.');
      data=pages[0];
    } else {
      if(!['image/jpeg','image/png'].includes(file.type)&&!/\.(jpe?g|png)$/i.test(file.name))throw new Error('Choisir un fichier JPG ou PNG.');
      data=await processImage(file,entry.arrayKey==='invoices'?2200:1900,0.9);
    }
    // Valider avant l'envoi et ne remplacer la référence qu'après un upload réussi.
    const image=await decode(await sourceAsBlob(data));image.close?.();
    if(!stillCurrent(entry,reportId))throw new Error('Le rapport ou la photo a changé. Relancer le diagnostic.');
    const key=entry.field||entry.arrayKey;
    const url=await uploadImageDataUrl(data,`reports/${reportId}/${key}-${entry.id||'image'}-${Date.now()}.jpg`);
    if(!stillCurrent(entry,reportId))throw new Error('Le fichier a été envoyé, mais le rapport a changé : aucune référence du rapport n’a été remplacée.');
    commit(entry,url);
  }
  function showDiagnostic(results,summary,reportId) {
    const panel=document.getElementById('imageDiagnostics');panel.replaceChildren();panel.hidden=false;
    const title=document.createElement('p');title.textContent=summary;panel.appendChild(title);
    const exportButton=document.createElement('button');exportButton.className='btn';exportButton.textContent='Télécharger le diagnostic';
    exportButton.onclick=()=>{
      const data=results.map(r=>({...publicEntry(r.entry),etat:r.error?'échec':r.refreshed?'lien actualisé pour la lecture':'OK',
        code:r.error?.code,http:r.error?.httpStatus,resolutionStorage:r.error?.sdkCode,detail:r.error?explain(r.error):undefined}));
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='diagnostic-photos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };panel.appendChild(exportButton);
    for(const result of results.filter(r=>r.error||r.refreshed)) {
      const row=document.createElement('div');row.style.cssText='margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:8px;overflow-wrap:anywhere';
      const info=document.createElement('p');info.style.whiteSpace='pre-wrap';
      const entry=result.entry;
      info.textContent=`${entry.label}\nPosition : ${entry.path}${entry.id?` — ID : ${entry.id}`:''}\nFichier : ${sourceInfo(entry.src)}\n${result.error?explain(result.error):'Un lien actuel a permis de lire cette image. L’ancien lien est probablement devenu invalide.'}`;
      row.appendChild(info);
      if(result.refreshed) {
        const button=document.createElement('button');button.className='btn';button.textContent='Enregistrer le lien actuel';
        button.onclick=()=>{
          if(!stillCurrent(entry,reportId)){alert('Le rapport ou la photo a changé. Relancer le diagnostic.');return;}
          commit(entry,result.refreshed);button.disabled=true;button.textContent='Lien enregistré';
        };row.appendChild(button);
      }
      if(result.error && entry.path!=='logo') {
        const input=document.createElement('input');input.type='file';input.hidden=true;
        input.accept=entry.arrayKey==='invoices'?'image/jpeg,image/png,application/pdf':'image/jpeg,image/png';
        const button=document.createElement('button');button.className='btn';button.textContent='Remplacer cette image';
        button.onclick=()=>input.click();
        input.onchange=async()=>{
          const file=input.files[0];if(!file)return;button.disabled=true;button.textContent='Envoi en cours…';
          try { await replace(entry,reportId,file); }
          catch(error){alert('Remplacement impossible : '+(error.message||'erreur inconnue'));}
          finally {input.value='';button.disabled=false;button.textContent='Remplacer cette image';}
        };row.appendChild(button);row.appendChild(input);
      }
      panel.appendChild(row);
    }
  }
  async function diagnose() {
    const button=document.getElementById('btnCheckImages');button.disabled=true;
    const reportId=currentReportId,revision=reportPreviewRevision,list=entries(),results=new Array(list.length);
    // Cache indépendant : vérifie aussi les images que l'aperçu a déjà chargées.
    const cache=new Map();let next=0,done=0;
    document.getElementById('imageDiagnostics').hidden=true;
    const worker=async()=>{
      while(next<list.length && revision===reportPreviewRevision && currentReportId===reportId) {
        const i=next++,entry=list[i];
        try {
          if(!entry.src)throw failure('invalid-image-source','Référence absente');
          await load(entry.src,cache);results[i]={entry,refreshed:refreshed.get(entry.src)};
        } catch(error){results[i]={entry,error};}
        done++;button.textContent=`Vérification ${done}/${list.length}…`;
      }
    };
    try {
      await Promise.all(Array.from({length:Math.min(3,list.length)},worker));
      if(revision!==reportPreviewRevision||currentReportId!==reportId)return;
      const count=results.filter(r=>r.error).length;
      showDiagnostic(results,`${list.length} image(s) vérifiée(s) — ${count} échec(s). Les images désactivées dans le rapport sont exclues.`,reportId);
    } finally {
      for(const promise of cache.values())promise.then(img=>img?.close?.()).catch(()=>{});
      button.disabled=false;button.textContent='Vérifier les photos';
    }
  }
  function install() {
    const tools=document.querySelector('.preview-tools');
    tools.style.flexWrap='wrap';
    const retry=document.createElement('button');retry.className='btn';retry.textContent='Réessayer';
    retry.onclick=()=>renderReport(true);tools.appendChild(retry);
    const check=document.createElement('button');check.className='btn';check.id='btnCheckImages';check.textContent='Vérifier les photos';
    check.onclick=diagnose;tools.appendChild(check);
    const panel=document.createElement('div');panel.id='imageDiagnostics';panel.hidden=true;
    panel.style.cssText='padding:16px;background:var(--panel,#fff);border:1px solid var(--line);border-radius:10px;margin-bottom:12px';
    tools.after(panel);
  }
  return {remoteBlob,sourceAsBlob,load,entries,sourceInfo,explain,message,previewError,diagnose,replace,install};
})();
