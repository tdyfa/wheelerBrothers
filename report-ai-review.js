/* WheelerBrothers 56.5 — pure, shared review operations; no image decoding or upload. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WBReportAIReview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const galleryKey=p=>p.kind==='section'?'section|'+p.sectionId+'|'+(p.side||''):p.kind;
  const photosIn=(plan,key)=>plan.photos.filter(p=>galleryKey(p)===key).sort((a,b)=>a.order-b.order);
  function renumber(photos){photos.forEach((p,i)=>{p.order=i;});}
  function setPosition(plan,id,position){
    const photo=plan.photos.find(p=>p.id===id);if(!photo)throw new Error('Photo introuvable.');
    const list=photosIn(plan,galleryKey(photo)),from=list.indexOf(photo),to=Number(position)-1;
    if(!Number.isInteger(to)||to<0||to>=list.length)throw new Error('Choisis une position de 1 à '+list.length+'.');
    list.splice(from,1);list.splice(to,0,photo);renumber(list);return to+1;
  }
  function moveSection(plan,id,position){
    const from=plan.sections.findIndex(s=>s.id===id),to=Number(position)-1;
    if(from<0||!Number.isInteger(to)||to<0||to>=plan.sections.length)throw new Error('Position de prestation invalide.');
    const [section]=plan.sections.splice(from,1);plan.sections.splice(to,0,section);
  }
  function uniqueLines(values){
    const seen=new Set(),lines=[];
    values.forEach(value=>String(value||'').split(/\n+/).forEach(line=>{
      line=line.trim();const key=norm(line);if(key&&!seen.has(key)){seen.add(key);lines.push(line);}
    }));return lines.join('\n');
  }
  function removeSection(plan,id){
    if(!plan.sections.some(s=>s.id===id))return 0;
    plan.sections=plan.sections.filter(s=>s.id!==id);let count=0;
    const rest=photosIn(plan,'unassigned');
    plan.photos.forEach(p=>{if(p.sectionId===id&&p.kind==='section'){
      p.kind='unassigned';p.sectionId='';p.side='';p.reason='Prestation supprimée : choisir une nouvelle affectation ou retirer la photo du rapport.';rest.push(p);count++;
    }});renumber(rest);return count;
  }
  function mergeSections(plan,sourceId,targetId){
    if(sourceId===targetId)throw new Error('Choisis une autre prestation.');
    const source=plan.sections.find(s=>s.id===sourceId),target=plan.sections.find(s=>s.id===targetId);
    if(!source||!target)throw new Error('Prestation introuvable.');
    const description=uniqueLines([target.description,source.description]);
    if(description.length>1600)throw new Error('Les descriptions réunies dépassent 1 600 caractères. Abrège-les avant de fusionner.');
    // Source photo order is preserved and appended, never globally sorted after a manual edit.
    const incoming=plan.photos.filter(p=>p.kind==='section'&&p.sectionId===sourceId).sort((a,b)=>a.order-b.order);
    const tails=new Map();for(const key of ['', 'L', 'R'])tails.set(key,photosIn(plan,'section|'+targetId+'|'+key));
    const unassigned=photosIn(plan,'unassigned');
    incoming.forEach(p=>{
      if(target.type==='sym'&&!['L','R'].includes(p.side)){
        p.kind='unassigned';p.sectionId='';p.side='';p.reason='Fusion vers une prestation gauche/droite : confirmer le côté.';unassigned.push(p);
      }else{p.sectionId=targetId;p.side=target.type==='normal'?'':p.side;tails.get(p.side).push(p);}
    });tails.forEach(renumber);renumber(unassigned);
    target.description=description;
    plan.sections=plan.sections.filter(s=>s.id!==sourceId);return target;
  }
  function excludePhoto(plan,id){
    const p=plan.photos.find(p=>p.id===id);if(!p||p.kind==='excluded')return;
    const others=photosIn(plan,'excluded');
    p.reviewPrevious={kind:p.kind,sectionId:p.sectionId,side:p.side,order:p.order,reason:p.reason};
    Object.assign(p,{kind:'excluded',sectionId:'',side:'',order:others.length,reason:'Retirée du rapport par l’utilisateur. Le fichier original est conservé.'});
  }
  function restorePhoto(plan,id){
    const p=plan.photos.find(p=>p.id===id);if(!p||p.kind!=='excluded')return;
    const previous=p.reviewPrevious||{kind:'unassigned',sectionId:'',side:'',order:0,reason:'Choisir une affectation.'};
    if(previous.kind==='section'&&!plan.sections.some(s=>s.id===previous.sectionId))Object.assign(previous,{kind:'unassigned',sectionId:'',side:'',reason:'La prestation d’origine a été supprimée.'});
    Object.assign(p,previous);delete p.reviewPrevious;
    const list=photosIn(plan,galleryKey(p)).filter(x=>x!==p),pos=Math.max(0,Math.min(list.length,previous.order));
    list.splice(pos,0,p);renumber(list);
  }
  function moveTo(plan,id,key){
    const p=plan.photos.find(p=>p.id===id);if(!p)throw new Error('Photo introuvable.');
    if(key==='excluded'){excludePhoto(plan,id);return;}
    const [kind,sectionId='',side='']=key.split('|');
    Object.assign(p,{kind,sectionId,side,reason:''});delete p.reviewPrevious;
    const list=photosIn(plan,key).filter(x=>x!==p);list.push(p);renumber(list);
  }
  // A numeric filename is a sorting hint, not proof of an operation or before/after.
  // Sort only within the same filename series, in its existing slots; mixed cameras
  // and names without a number retain their AI/selection order.
  function fileSequence(name){
    const stem=String(name||'').replace(/\.[^.]*$/,'').replace(/\s*\(\d+\)$/,'');
    const match=stem.match(/^(.*?)(\d+)([^\d]*)$/);if(!match)return null;
    const number=Number(match[2]);if(!Number.isSafeInteger(number))return null;
    return {family:norm(match[1])+'|'+norm(match[3]),number};
  }
  function sortByFilename(plan,assets,target){
    const byId=new Map(assets.map(a=>[a.id,a]));
    const keys=target?[target]:[...new Set(plan.photos.map(galleryKey))].filter(k=>!['excluded','invoice','baieAvant','baieApres'].includes(k));
    keys.forEach(key=>{
      const list=photosIn(plan,key),families=new Map();
      list.forEach((p,i)=>{const f=fileSequence(byId.get(p.id)?.name);if(!f)return;const slots=families.get(f.family)||[];slots.push({photo:p,index:i,number:f.number});families.set(f.family,slots);});
      families.forEach(slots=>{const sorted=slots.slice().sort((a,b)=>a.number-b.number||a.index-b.index);slots.forEach((slot,i)=>list[slot.index]=sorted[i].photo);});renumber(list);
    });return plan;
  }
  function isEngineBayTitle(title){
    const t=norm(title);
    return /^(?:(?:entretien|nettoyage|lavage|degraissage|renovation|vue|vues)\s+(?:(?:de la|du|de|des|d)\s+)?)?(?:baie|compartiment) moteur(?:\s+(?:avant|apres|avant apres))?$/.test(t);
  }
  function convertEngineBay(plan,id){
    const section=plan.sections.find(s=>s.id===id);if(!section)return;
    plan.sections=plan.sections.filter(s=>s.id!==id);
    const list=photosIn(plan,'baiePending');
    plan.photos.filter(p=>p.kind==='section'&&p.sectionId===id).sort((a,b)=>a.order-b.order).forEach(p=>{
      Object.assign(p,{kind:'baiePending',sectionId:'',side:'',reason:'Entretien baie moteur : choisis Avant ou Après. Aucun stade déduit du nom du fichier.'});list.push(p);
    });renumber(list);plan.engineBayExpected=true;
  }
  function summaryFromSections(plan){
    const values=plan.sections.map(s=>s.title.trim()).filter(Boolean);
    if(plan.engineBayExpected||plan.photos.some(p=>['baieAvant','baieApres','baiePending'].includes(p.kind)))values.push('Entretien baie moteur');
    return [...new Map(values.map(x=>[norm(x),x])).values()].join(' + ');
  }
  function duplicateHints(plan){
    const clean=t=>norm(t).replace(/\b(remplacement|entretien|nettoyage|des|du|de|les|le|la|d|et)\b/g,' ').replace(/\s+/g,' ').trim();
    const key=s=>{const t=norm(s.title);if(/^((remplacement|nettoyage) (des |de |d )?)?injecteurs?( (et )?(puits? |puis )(d )?injecteurs?)?$/.test(t))return 'injecteurs';return clean(t);};
    const groups=new Map();plan.sections.forEach(s=>{const k=key(s)+'|'+s.type;(groups.get(k)||groups.set(k,[]).get(k)).push(s);});
    return [...groups.values()].filter(g=>g.length>1);
  }
  function issueList(plan){
    const out=[],seen=new Set(),add=(code,message,extra={})=>out.push({code,message,...extra});
    if(!String(plan.summary||'').trim())add('summary','Le résumé global est vide.');
    if(!plan.sections.length&&!plan.photos.some(p=>['baieAvant','baieApres'].includes(p.kind)))add('empty','Ajoute au moins une prestation illustrée ou les photos de baie moteur.');
    for(const p of plan.photos){
      if(p.kind==='unassigned')add('photo','Photo à classer.',{photoId:p.id});
      if(p.kind==='baiePending')add('bay-stage','Baie moteur : choisir Avant ou Après pour cette photo.',{photoId:p.id});
      if(['overview','labelR','labelV','baieAvant','baieApres'].includes(p.kind)){
        if(seen.has(p.kind))add('single','Plusieurs photos sur un emplacement unique : reclasser ou retirer les autres.',{photoId:p.id,kind:p.kind});seen.add(p.kind);
      }
      if(p.kind==='section'){
        const s=plan.sections.find(s=>s.id===p.sectionId);
        if(!s)add('orphan','Photo sans prestation valide.',{photoId:p.id});
        else if(s.type==='sym'&&!['L','R'].includes(p.side))add('side','Choisir le côté gauche ou droit.',{photoId:p.id,sectionId:s.id});
      }
    }
    plan.sections.forEach(s=>{
      if(!s.title.trim())add('title','Titre de prestation vide.',{sectionId:s.id});
      const images=plan.photos.filter(p=>p.kind==='section'&&p.sectionId===s.id);
      if(!images.length)add('missing','Photos manquantes : '+(s.title||'Prestation sans titre'),{sectionId:s.id});
      else if(s.type==='sym')for(const [side,label] of [['L','gauche'],['R','droite']])if(!images.some(p=>p.side===side))add('missing-side','Photos '+label+' manquantes : '+s.title,{sectionId:s.id,side});
    });
    if(plan.engineBayExpected&&!plan.photos.some(p=>['baieAvant','baieApres','baiePending'].includes(p.kind)))add('missing-bay','Photos manquantes : entretien baie moteur (bloc séparé).',{kind:'baiePending'});
    return out;
  }
  return {clone,norm,galleryKey,photosIn,setPosition,moveSection,mergeSections,removeSection,excludePhoto,restorePhoto,moveTo,sortByFilename,fileSequence,isEngineBayTitle,convertEngineBay,summaryFromSections,duplicateHints,issueList,uniqueLines};
});
