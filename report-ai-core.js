/* WheelerBrothers 54 — contrat IA partagé navigateur/serveur. Aucune clé. */
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.WBReportAICore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const MAX_IMAGES = 100;
  const KINDS = ['overview','products','labelR','labelV','baieAvant','baieApres','invoice','section','unassigned'];
  const SINGLE = ['overview','products','labelR','labelV','baieAvant','baieApres'];
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
    if(raw.sections.length < 1 || raw.sections.length > 35) throw new Error('Nombre de prestations invalide.');
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
  function reviewProblems(plan){
    const problems=[];
    if(!plan.summary.trim()) problems.push('Le résumé est vide.');
    const unique=new Set();
    plan.photos.forEach(p=>{
      if(p.kind==='unassigned') problems.push('Photo à classer : '+p.id);
      if(SINGLE.includes(p.kind)){
        if(unique.has(p.kind)) problems.push('Un seul cliché est possible pour « '+p.kind+' ».');
        unique.add(p.kind);
      }
      if(p.kind==='section'){
        const s=plan.sections.find(s=>s.id===p.sectionId);
        if(!s) problems.push('Photo sans prestation valide : '+p.id);
        else if(s.type==='sym' && !['L','R'].includes(p.side)) problems.push('Côté manquant : '+p.id);
      }
    });
    plan.sections.forEach(s=>{
      const photos=plan.photos.filter(p=>p.kind==='section' && p.sectionId===s.id);
      if(!s.title.trim()) problems.push('Titre de prestation vide.');
      if(!photos.length) problems.push('Photos manquantes : '+s.title);
      else if(s.type==='sym'){
        if(!photos.some(p=>p.side==='L')) problems.push('Photos gauche manquantes : '+s.title);
        if(!photos.some(p=>p.side==='R')) problems.push('Photos droite manquantes : '+s.title);
      }
    });
    return [...new Set(problems)];
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
  return {MAX_IMAGES,KINDS,SINGLE,PLAN_SCHEMA,normalizePlan,reviewProblems,makeReport};
});
