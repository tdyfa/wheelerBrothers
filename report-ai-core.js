/* WheelerBrothers 56.5 — contrat IA partagé navigateur/serveur. Aucune clé. */
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.WBReportAICore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const MAX_IMAGES = 100;
  const KINDS = ['overview','products','labelR','labelV','baieAvant','baieApres','invoice','section','unassigned'];
  const SINGLE = ['overview','labelR','labelV','baieAvant','baieApres'];
  function text(value, max=1000){
    if(typeof value !== 'string') throw new Error('Texte IA invalide.');
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,max);
  }
  function obj(properties){return {type:'object',properties,required:Object.keys(properties),additionalProperties:false};}
  const str = {type:'string'};
  const PLAN_SCHEMA = obj({
    summary: str,
    sections: {type:'array',items:obj({id:str,title:str,description:str,type:{type:'string',enum:['normal','sym']}})},
    photos: {type:'array',items:obj({
      id:str,kind:{type:'string',enum:KINDS},sectionId:str,side:{type:'string',enum:['','L','R']},
      order:{type:'integer'},caption:str,reason:str
    })},
    warnings:{type:'array',items:str}
  });
  function normalizePlan(raw, assets){
    if(!raw || !Array.isArray(raw.sections) || !Array.isArray(raw.photos) || !Array.isArray(raw.warnings)) throw new Error('Réponse IA incomplète.');
    if(raw.sections.length > 35) throw new Error('Nombre de prestations invalide.');
    const sectionIds = new Set();
    const sections = raw.sections.map(s=>{
      if(!s || !/^[A-Za-z0-9_-]{1,48}$/.test(s.id) || sectionIds.has(s.id) || !['normal','sym'].includes(s.type)) throw new Error('Identifiant ou type de prestation invalide.');
      sectionIds.add(s.id);
      const title=text(s.title,160);
      if(!title) throw new Error('Une prestation ne possède pas de titre.');
      return {id:s.id,title,description:text(s.description,1600),type:s.type};
    });
    const known=new Set(assets.map(a=>a.id)), seen=new Set(), singles=new Set();
    const warnings=raw.warnings.slice(0,50).map(w=>text(w,700));
    const photos=raw.photos.map(p=>{
      if(!p || !known.has(p.id) || seen.has(p.id) || !KINDS.includes(p.kind) || !Number.isInteger(p.order)) throw new Error('Référence photo inconnue, dupliquée ou invalide.');
      seen.add(p.id);
      const item={id:p.id,kind:p.kind,sectionId:text(p.sectionId,48),side:p.side,order:Math.max(0,Math.min(10000,p.order)),caption:text(p.caption,350),reason:text(p.reason,700)};
      if(!['','L','R'].includes(item.side)) throw new Error('Côté photo invalide.');
      if(item.kind==='section'){
        const s=sections.find(s=>s.id===item.sectionId);
        if(!s) throw new Error('Une photo désigne une prestation inexistante.');
        if(s.type==='sym' && !item.side){item.kind='unassigned';item.reason='Côté gauche/droite à confirmer.';}
        if(s.type==='normal') item.side='';
      }
      if(SINGLE.includes(item.kind)){
        if(singles.has(item.kind)){item.kind='unassigned';item.reason='Plusieurs photos proposées pour le même emplacement : choisir ou reclasser.';}
        else singles.add(item.kind);
      }
      return item;
    });
    assets.forEach((a,i)=>{if(!seen.has(a.id)) photos.push({id:a.id,kind:'unassigned',sectionId:'',side:'',order:i,caption:'',reason:'Photo non classée par l’IA : affectation obligatoire.'});});
    return {summary:text(raw.summary,1600),sections,photos,warnings};
  }
  function normalizeReviewPlan(raw,assets){
    const local=JSON.parse(JSON.stringify(raw)),excluded=new Map();
    for(const p of local.photos||[])if(p.kind==='excluded'){excluded.set(p.id,{reason:p.reason,from:p.excludedFrom});p.kind='unassigned';p.sectionId='';p.side='';}
    const result=normalizePlan(local,assets);
    for(const p of result.photos)if(excluded.has(p.id)){
      const old=excluded.get(p.id);p.kind='excluded';p.reason=typeof old.reason==='string'?old.reason.slice(0,700):'';
      if(old.from&&KINDS.includes(old.from.kind))p.excludedFrom={kind:old.from.kind,sectionId:String(old.from.sectionId||'').slice(0,48),side:['L','R'].includes(old.from.side)?old.from.side:'',order:Number.isInteger(old.from.order)?old.from.order:0,reason:String(old.from.reason||'').slice(0,700)};
    }
    return result;
  }
  function reviewIssues(plan){
    const issues=[];
    if(!String(plan.summary||'').trim()) issues.push({kind:'summary',message:'Le résumé global est vide.'});
    if(!plan.sections.length && !plan.photos.some(p=>['baieAvant','baieApres'].includes(p.kind)))
      issues.push({kind:'empty',message:'Conserve au moins une prestation illustrée ou une photo de baie moteur.'});
    const unique=new Set(),seen=new Set();
    plan.photos.forEach(p=>{
      if(seen.has(p.id))issues.push({kind:'photo',photoId:p.id,message:'Photo en double : '+p.id});
      seen.add(p.id);
      if(p.kind==='excluded')return; // Deliberate user choice; never made by the model.
      if(p.kind==='unassigned')issues.push({kind:'photo',photoId:p.id,message:'Photo à classer : '+p.id});
      else if(!KINDS.includes(p.kind))issues.push({kind:'photo',photoId:p.id,message:'Affectation invalide : '+p.id});
      if(SINGLE.includes(p.kind)){
        if(unique.has(p.kind))issues.push({kind:'photo',photoId:p.id,message:'Un seul cliché est possible pour « '+p.kind+' ».'});
        unique.add(p.kind);
      }
      if(p.kind==='section'){
        const s=plan.sections.find(s=>s.id===p.sectionId);
        if(!s)issues.push({kind:'photo',photoId:p.id,message:'Photo sans prestation valide : '+p.id});
        else if(s.type==='sym' && !['L','R'].includes(p.side))issues.push({kind:'photo',photoId:p.id,message:'Côté manquant : '+p.id});
      }
    });
    plan.sections.forEach(s=>{
      const photos=plan.photos.filter(p=>p.kind==='section' && p.sectionId===s.id);
      if(!String(s.title||'').trim())issues.push({kind:'section',sectionId:s.id,message:'Titre de prestation vide.'});
      if(!photos.length)issues.push({kind:'section',sectionId:s.id,empty:true,message:'Photos manquantes : '+s.title});
      else if(s.type==='sym'){
        if(!photos.some(p=>p.side==='L'))issues.push({kind:'section',sectionId:s.id,message:'Photos gauche manquantes : '+s.title});
        if(!photos.some(p=>p.side==='R'))issues.push({kind:'section',sectionId:s.id,message:'Photos droite manquantes : '+s.title});
      }
    });
    return issues;
  }
  function reviewProblems(plan){return [...new Set(reviewIssues(plan).map(i=>i.message))];}
  function galleryKey(p){return p.kind==='section'?'section|'+p.sectionId+'|'+(p.side||''):p.kind;}
  function gallery(plan,key){return plan.photos.filter(p=>galleryKey(p)===key).sort((a,b)=>a.order-b.order);}
  function movePhoto(plan,id,position){
    const p=plan.photos.find(p=>p.id===id);if(!p)return false;
    const g=gallery(plan,galleryKey(p)),index=g.indexOf(p);
    if(!Number.isInteger(position)||position<1||position>g.length)return false;
    g.splice(index,1);g.splice(position-1,0,p);g.forEach((p,i)=>p.order=i);return true;
  }
  function moveSection(plan,id,position){
    const index=plan.sections.findIndex(s=>s.id===id);
    if(index<0||!Number.isInteger(position)||position<1||position>plan.sections.length)return false;
    const [s]=plan.sections.splice(index,1);plan.sections.splice(position-1,0,s);return true;
  }
  function excludePhoto(plan,id){
    const p=plan.photos.find(p=>p.id===id);if(!p||p.kind==='excluded')return false;
    p.excludedFrom={kind:p.kind,sectionId:p.sectionId,side:p.side,order:p.order,reason:p.reason||''};
    p.kind='excluded';p.sectionId='';p.side='';p.reason='Retirée du rapport par toi. Le fichier original est conservé.';return true;
  }
  function restorePhoto(plan,id){
    const p=plan.photos.find(p=>p.id===id);if(!p||p.kind!=='excluded')return false;
    const old=p.excludedFrom;
    if(old && (old.kind!=='section'||plan.sections.some(s=>s.id===old.sectionId)))Object.assign(p,old);
    else Object.assign(p,{kind:'unassigned',sectionId:'',side:'',order:0,reason:'Photo rétablie : choisir sa destination.'});
    delete p.excludedFrom;return true;
  }
  function dropSection(plan,id,destination='unassigned'){
    const s=plan.sections.find(s=>s.id===id);if(!s)throw new Error('Prestation introuvable.');
    const target=plan.sections.find(s=>s.id===destination);
    if(destination===id || (!target && !['unassigned','excluded','engineBay'].includes(destination)))throw new Error('Destination invalide.');
    const photos=plan.photos.filter(p=>p.kind==='section'&&p.sectionId===id).sort((a,b)=>a.order-b.order);
    if(target && target.type==='sym' && s.type!=='sym' && photos.length)throw new Error('Classe d’abord les photos à gauche ou à droite avec leur menu Affectation.');
    for(const p of photos){
      if(destination==='excluded'){excludePhoto(plan,p.id);continue;}
      const side=target?.type==='sym'?p.side:'';
      const key=target?'section|'+target.id+'|'+side:'unassigned';
      const next=gallery(plan,key).length;
      Object.assign(p,{kind:target?'section':'unassigned',sectionId:target?.id||'',side,order:next,
        reason:destination==='engineBay'?'Baie moteur : choisis Avant ou Après dans Affectation, ou retire le cliché.':target?'':'Prestation supprimée : choisir une nouvelle affectation.'});
    }
    // Only a user action removes a retained operation. Never remove the original image.
    plan.sections=plan.sections.filter(s=>s.id!==id);return photos.length;
  }
  function normalizedText(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function isEngineBay(title){
    const t=normalizedText(title);return /\b(baie moteur|compartiment moteur)\b/.test(t) && !/\b(admission|boite a air|filtre|joint|radiateur|distribution)\b/.test(t);
  }
  function cleanDescription(value){
    // Conservative lossless text deduplication. Unknown references are retained.
    const seen=new Set();return String(value||'').split(/[;\n]+/).map(s=>s.trim()).filter(s=>{
      if(!s)return false;const k=normalizedText(s);if(seen.has(k))return false;seen.add(k);return true;
    }).join('\n').slice(0,1600);
  }
  function summaryFromSections(plan){
    const titles=[],seen=new Set();
    for(const s of plan.sections){const title=String(s.title||'').trim(),key=normalizedText(title);if(title&&!seen.has(key)){titles.push(title);seen.add(key);}}
    if(plan.photos.some(p=>['baieAvant','baieApres'].includes(p.kind)))titles.push('Entretien baie moteur');
    return titles.join(' ; ').slice(0,1600);
  }
  function sortGalleryByFilename(plan,assets,key){
    const byId=new Map(assets.map((a,i)=>[a.id,{name:a.name||'',index:i}]));
    const g=gallery(plan,key);
    g.sort((a,b)=>{
      const x=byId.get(a.id)||{name:'',index:0},y=byId.get(b.id)||{name:'',index:0};
      return x.name.localeCompare(y.name,'fr',{numeric:true,sensitivity:'base'})||x.index-y.index;
    });g.forEach((p,i)=>p.order=i);return g;
  }
  function initialPhotoOrder(plan,assets){
    new Set(plan.photos.map(galleryKey)).forEach(key=>{
      if(key==='invoice')return; // Invoice page order is documentary, not photographic.
      sortGalleryByFilename(plan,assets,key);
    });return plan;
  }
  function makeReport(plan, assets, meta, blank, urls){
    const problems=reviewProblems(plan);
    if(problems.length) throw new Error(problems.join('\n'));
    const report=JSON.parse(JSON.stringify(blank));
    ['plate','brand','model','engine','reg','km','date'].forEach(k=>{report[k]=text(meta[k]||'',160);});
    report.summary=text(plan.summary,1600);
    report.closing=text(meta.closing||'',2000);
    report.checkpoints=(report.checkpoints||[]).map((cp,i)=>({...cp,checked:Array.isArray(meta.checkpoints) && meta.checkpoints[i]===true}));
    const ordered=plan.photos.slice().sort((a,b)=>a.order-b.order);
    function src(id){
      const value=urls[id];
      if(typeof value!=='string' || !/^https:\/\/firebasestorage\.googleapis\.com\//.test(value)) throw new Error('Photo Firebase manquante ou invalide : '+id);
      return value;
    }
    SINGLE.forEach(k=>{const p=ordered.find(p=>p.kind===k);report[k]=p?src(p.id):null;});
    report.products=null;
    report.productsPhotos=ordered.filter(p=>p.kind==='products').map(p=>({id:'ai_product_'+p.id,src:src(p.id),cap:text(p.caption,350)}));
    report.baieOn=Boolean(report.baieAvant || report.baieApres);
    report.baieTitle='';
    report.invoices=ordered.filter(p=>p.kind==='invoice').map(p=>({id:'ai_inv_'+p.id,kind:'img',src:src(p.id),name:assets.find(a=>a.id===p.id)?.name||'Facture'}));
    report.invoicesOn=report.invoices.length>0;
    report.sections=plan.sections.map((s,i)=>{
      const selected=ordered.filter(p=>p.kind==='section' && p.sectionId===s.id);
      const photo=p=>({id:'ai_ph_'+p.id,src:src(p.id),cap:text(p.caption,350)});
      const out={id:'ai_sec_'+(i+1),type:s.type,title:text(s.title,160),desc:text(s.description,1600),cols:s.type==='sym'?1:2,rowsPerPage:2,newpage:false,photos:[]};
      if(s.type==='sym') Object.assign(out,{labelL:'Gauche',labelR:'Droite',photosL:selected.filter(p=>p.side==='L').map(photo),photosR:selected.filter(p=>p.side==='R').map(photo)});
      else out.photos=selected.map(photo);
      return out;
    });
    return report;
  }
  return {MAX_IMAGES,KINDS,SINGLE,PLAN_SCHEMA,normalizePlan,normalizeReviewPlan,reviewProblems,reviewIssues,makeReport,galleryKey,gallery,movePhoto,moveSection,excludePhoto,restorePhoto,dropSection,normalizedText,isEngineBay,cleanDescription,summaryFromSections,sortGalleryByFilename,initialPhotoOrder};
});
