/* WheelerBrothers — informations véhicule communes à Atelier et aux rapports.
 * `modele` conserve le libellé historique complet pour les exports et WB Carnet.
 * Les nouveaux champs structurés sont ajoutés sans migration globale des fiches.
 */
(function(global){
  'use strict';
  const text = value => typeof value === 'string' ? value.trim() : '';
  const key = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').toLowerCase();
  const brands = [
    ['Mercedes-Benz',['Mercedes-Benz','Mercedes Benz','Mercedes']],
    ['Volkswagen',['Volkswagen','VW']], ['Citroën',['Citroën','Citroen']],
    ['Škoda',['Škoda','Skoda']], ['Alfa Romeo',['Alfa Romeo']],
    ['Land Rover',['Land Rover']], ['Aston Martin',['Aston Martin']],
    ...['Audi','BMW','Peugeot','Renault','Dacia','DS','Opel','Ford','Toyota','Lexus',
      'Nissan','Honda','Hyundai','Kia','Mazda','Mitsubishi','Suzuki','Subaru','Volvo',
      'Saab','Seat','Cupra','Fiat','Abarth','Lancia','Jeep','Chrysler','Dodge','Chevrolet',
      'Tesla','Porsche','Mini','Smart','Jaguar','Bentley','Ferrari','Maserati',
      'Lamborghini','Lotus','Alpine','Daihatsu','Isuzu','MG','BYD','Polestar',
      'Yamaha','Kawasaki','Ducati','Triumph','KTM','Aprilia','Piaggio','Harley-Davidson',
      'Moto Guzzi','Royal Enfield'].map(name=>[name,[name]])
  ].flatMap(([brand,aliases])=>aliases.map(alias=>({brand,alias,key:key(alias)})))
    .sort((a,b)=>b.key.length-a.key.length);

  function normalizePlate(value){ return text(value).toUpperCase().replace(/[^A-Z0-9]/g,''); }
  function isoDate(value){
    const raw=text(value);
    let y,m,d;
    let match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if(match){ [,y,m,d]=match; }
    else {
      match=/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(raw);
      if(!match)return '';
      [,d,m,y]=match;
    }
    const year=Number(y), month=Number(m), day=Number(d);
    const date=new Date(0);
    date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);
    if(year<1000 || year>9999 || date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day)return '';
    return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function formatDate(value){
    const iso=isoDate(value);
    return iso ? `${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}` : '';
  }
  function stripBrand(label,brand){
    const value=text(label), normalized=key(value), brandKey=key(brand);
    const candidates=[brandKey,...brands.filter(item=>key(item.brand)===brandKey).map(item=>item.key)]
      .filter(Boolean).sort((a,b)=>b.length-a.length);
    for(const prefix of candidates){
      if(normalized===prefix)return '';
      if(normalized.startsWith(prefix+' ')){
        // La normalisation retire les accents mais ne modifie pas le nombre de mots.
        return value.split(/\s+/).slice(prefix.split(' ').length).join(' ');
      }
    }
    return value;
  }
  function fromVehicle(vehicle={}){
    const label=text(vehicle.modele);
    let brand=text(vehicle.marque), model=text(vehicle.modeleDetail), inferred=false;
    if(!brand && !model){
      const normalized=key(label);
      const known=brands.find(item=>normalized===item.key || normalized.startsWith(item.key+' '));
      if(known){brand=known.brand;model=stripBrand(label,brand);inferred=true;}
    }
    if(!model)model=brand ? stripBrand(label,brand) : label;
    const engine=text(vehicle.motorisation);
    return {
      brand,model,
      engine:/^non renseigne[es]*$/i.test(key(engine)) ? '' : engine,
      reg:formatDate(vehicle.dateMiseEnCirculation),
      isoReg:isoDate(vehicle.dateMiseEnCirculation),
      inferred
    };
  }
  function fields(brand,model,reg){
    brand=text(brand);model=brand ? stripBrand(model,brand) : text(model);
    return {
      marque:brand,modeleDetail:model,
      modele:[brand,model].filter(Boolean).join(' '),
      dateMiseEnCirculation:isoDate(reg)
    };
  }
  function enrichFromReport(vehicle,report){
    const existing=fromVehicle(vehicle);
    // Un rapport ne remplace pas une information déjà présente dans la fiche.
    if(!text(vehicle.marque)){
      if(existing.brand)vehicle.marque=existing.brand;
      else if(text(report.brand) && key(report.model)===key(existing.model))vehicle.marque=text(report.brand);
    }
    if(!text(vehicle.modeleDetail) && existing.model)vehicle.modeleDetail=existing.model;
    if(!text(vehicle.dateMiseEnCirculation) && isoDate(report.reg))vehicle.dateMiseEnCirculation=isoDate(report.reg);
    if(!existing.engine && text(report.engine))vehicle.motorisation=text(report.engine);
    return vehicle;
  }
  global.WBVehicleInfo=Object.freeze({normalizePlate,isoDate,formatDate,fromVehicle,fields,enrichFromReport});
})(window);
