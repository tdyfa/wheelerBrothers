/* WheelerBrothers 53.3 — saisies véhicule communes, sans accès réseau. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WBVehicleInput=api;})(globalThis,function(){
  'use strict';
  const digits=v=>String(v??'').replace(/[^0-9]/g,'');
  const mileage=v=>digits(v).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
  const key=v=>String(v??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const isFrench=v=>/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(key(v));
  function plate(v){
    let s='';
    // Rejeter immédiatement les caractères incompatibles avec la position.
    // Deux lettres, trois chiffres, deux lettres : sept caractères utiles maximum.
    for(const c of key(v)){
      if(s.length===7)break;
      const expected=s.length<2 || s.length>=5 ? /[A-Z]/ : /[0-9]/;
      if(expected.test(c))s+=c;
    }
    return s.slice(0,2)+(s.length>2?'-'+s.slice(2,5):'')+(s.length>5?'-'+s.slice(5,7):'');
  }
  function edit(el,format,meaningful){
    const before=el.value,pos=el.selectionStart,count=meaningful(before.slice(0,pos??before.length)).length;
    el.value=format(before);
    if(pos!==null && document.activeElement===el){
      let at=0,n=0;while(at<el.value.length && n<count){if(meaningful(el.value[at]).length)n++;at++;}
      el.setSelectionRange(at,at);
    }
  }
  function formatKm(el){edit(el,mileage,digits);return digits(el.value);}
  function formatPlate(el,other){
    if(!other)edit(el,plate,key);
    el.setCustomValidity(!other && el.value && !isFrench(el.value)?'Saisis une plaque AA-123-BB ou coche « Autre format ».':'');
    return el.value;
  }
  function loadPlate(el,box,value){box.checked=Boolean(value)&&!isFrench(value);el.value=box.checked?String(value):plate(value);formatPlate(el,box.checked);}
  return {digits,mileage,key,isFrench,plate,formatKm,formatPlate,loadPlate};
});
