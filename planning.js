/* WheelerBrothers Planning v56 — journées entières, synchronisation Firestore */
(()=>{'use strict';
const $=id=>document.getElementById(id), MS=86400000;
const today=()=>{const d=new Date();return localISO(d)};
const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parse=s=>new Date(`${s}T12:00:00`);
const shift=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return localISO(d)};
const firstMonth=s=>s.slice(0,7)+'-01';
const monthShift=(s,n)=>{const d=parse(firstMonth(s));d.setMonth(d.getMonth()+n);return localISO(d)};
const weekStart=s=>shift(s,-((parse(s).getDay()+6)%7));
const labelDate=s=>parse(s).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unique=xs=>[...new Set(xs.filter(s=>/^\d{4}-\d\d-\d\d$/.test(s)&&localISO(parse(s))===s))].sort();
let draftPlanningId=null;
let collection=null,activeSpaceId=null,unsubscribe=null,items=[],editing=null,selected=[],pickAnchor=null,pickRange=false,pickMonth=firstMonth(today()),calendarMonth=firstMonth(today()),calendarWeek=weekStart(today()),calMode='month',tab='todo',pointerDown=false,dragStart=null;
function message(msg,error=false){$('notice').textContent=msg;$('notice').className=error?'error':'muted'}
function vehicleName(x){return [x.brand,x.model].filter(Boolean).join(' ').trim()||x.vehicle||'Véhicule non renseigné'}
function vehicleMeta(x){return [x.plate,x.owner].filter(Boolean).join(' - ')}
function normalizePlate(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function formatFrenchPlate(v){const c=normalizePlate(v).slice(0,7);return c.slice(0,2)+(c.length>2?'-'+c.slice(2,5):'')+(c.length>5?'-'+c.slice(5):'')}
function updatePlateDisplay(){const e=$('plate');if($('otherPlateFormat').checked){e.maxLength=40;e.placeholder='Immatriculation libre';return}e.maxLength=9;e.placeholder='AA-123-BB';e.value=formatFrenchPlate(e.value)}
function isOtherPlateFormat(v){const s=String(v||'').trim();return !!s&&!/^[A-Z]{2}-?[0-9]{3}-?[A-Z]{2}$/i.test(s)}

let knownVehicles=[],vehicleLoadToken=0,chosenVehicleId=null,editorFingerprint='';
function vehicleInfo(v){
 const info=window.WBVehicleInfo?.fromVehicle?.(v);
 return {id:v.id,plate:String(v.plate||'').trim(),brand:String(info?.brand||v.marque||'').trim(),model:String(info?.model||v.modeleDetail||v.modele||'').trim(),owner:String(v.owner||'').trim(),phone:WBPhone.format(v.phone||v.telephone||'')};
}
const vehicleSort=new Intl.Collator('fr',{sensitivity:'base',numeric:true});
function renderVehicleOptions(){
 const query=$('vehicleSearch').value.trim().toLocaleLowerCase('fr');
 const select=$('vehicleSelect');select.replaceChildren();
 const empty=document.createElement('option');empty.value='';empty.textContent='Sélectionner un véhicule…';select.append(empty);
 let found=0;
 knownVehicles.forEach((v,i)=>{
  const label=[v.brand,v.model,v.plate,v.owner].filter(Boolean).join(' - ');
  if(query&&!([v.brand,v.model,v.plate,v.owner].join(' ').toLocaleLowerCase('fr').includes(query)||normalizePlate(label).includes(normalizePlate(query))))return;
  const opt=document.createElement('option');opt.value=String(i);opt.textContent=label||'Véhicule sans informations';select.append(opt);found++;
 });
 $('vehicleListStatus').textContent=knownVehicles.length?`${found} véhicule(s) affiché(s) sur ${knownVehicles.length}`:'Aucun véhicule chargé';
}
async function loadKnownVehicles(){
 const token=++vehicleLoadToken;knownVehicles=[];$('vehicleSearch').value='';renderVehicleOptions();
 if(!activeSpaceId){$('vehicleListStatus').textContent='Connexion à l’atelier en cours…';return}
 $('vehicleListStatus').textContent='Chargement des véhicules…';
 try{
  const snap=await db.collection('spaces').doc(activeSpaceId).collection('tools').doc('atelier').get();
  if(token!==vehicleLoadToken||!$('editor').open)return;
  const data=snap.exists?JSON.parse(snap.data().payload||'{"vehicles":[]}'):{vehicles:[]};
  if(!Array.isArray(data.vehicles))throw new Error('Format de carnet invalide');
  knownVehicles=data.vehicles.filter(v=>v&&typeof v==='object').map(vehicleInfo).sort((a,b)=>{
   for(const key of ['brand','model','plate','owner']){const n=vehicleSort.compare(a[key],b[key]);if(n)return n}return 0;
  });
  renderVehicleOptions();
 }catch(err){if(token===vehicleLoadToken)$('vehicleListStatus').textContent='Impossible de charger les véhicules : '+err.message}
}
function selectKnownVehicle(){
 const i=$('vehicleSelect').value;if(i==='')return;
 const v=knownVehicles[Number(i)];if(!v)return;
 const fields=[['plate',v.plate],['brand',v.brand],['model',v.model],['owner',v.owner],['phone',v.phone]];
 if(fields.some(([id,value])=>value&&$(id).value.trim()&&(id==='phone'?!WBPhone.same($(id).value,value):$(id).value.trim()!==value))&&!confirm('Remplacer les informations déjà saisies par celles du carnet ?')){$('vehicleSelect').value='';return}
 chosenVehicleId=v.id;
 $('otherPlateFormat').checked=isOtherPlateFormat(v.plate);
 fields.forEach(([id,value])=>{$(id).value=id==='phone'?WBPhone.format(value):value});updatePlateDisplay();updateSmsWarning();lookupRevision++;lookupMessage('Véhicule sélectionné dans le carnet.');
}
let lookupRevision=0;
function lookupMessage(text,error=false){$('lookupStatus').textContent=text;$('lookupStatus').className=(error?'error':'muted')+' lookup-status'}
async function lookupVehicle(){const plate=normalizePlate($('plate').value);const revision=++lookupRevision;if(!plate){lookupMessage('Saisis une plaque avant de vérifier.');return}const button=$('lookupVehicle');button.disabled=true;lookupMessage('Recherche dans le carnet d’atelier…');try{const snap=await db.collection('spaces').doc(activeSpaceId).collection('tools').doc('atelier').get({source:'server'});if(revision!==lookupRevision)return;const data=snap.exists?JSON.parse(snap.data().payload||'{"vehicles":[]}'):{vehicles:[]};if(!Array.isArray(data.vehicles))throw new Error('Format de carnet invalide');const matches=data.vehicles.filter(v=>v&&normalizePlate(v.plate)===plate);if(matches.length!==1){lookupMessage(matches.length?'Plusieurs fiches correspondent à cette plaque : remplissage automatique désactivé.':'Aucune fiche trouvée. Tu peux renseigner les informations manuellement.',matches.length>1);return}const v=matches[0];chosenVehicleId=v.id;const info=window.WBVehicleInfo?.fromVehicle?.(v);const brand=info?.brand||String(v.marque||'').trim();const model=info?.model||String(v.modeleDetail||v.modele||'').trim();const owner=String(v.owner||'').trim();const phone=String(v.phone||v.telephone||'').trim();const fields=[['brand',brand],['model',model],['owner',owner],['phone',phone]];const conflicts=fields.filter(([id,value])=>value&&$(id).value.trim()&&(id==='phone'?!WBPhone.same($(id).value,value):$(id).value.trim()!==value));if(conflicts.length&&!confirm('Remplacer les informations déjà saisies par celles du carnet ?')){fields.forEach(([id,value])=>{if(!$(id).value.trim())$(id).value=id==='phone'?WBPhone.format(value):value})}else fields.forEach(([id,value])=>{if(value)$(id).value=id==='phone'?WBPhone.format(value):value});updateSmsWarning();lookupMessage('Fiche trouvée : informations récupérées.')}catch(err){if(revision===lookupRevision)lookupMessage('Recherche impossible : '+err.message,true)}finally{if(revision===lookupRevision)button.disabled=false}}
function isLate(x){return x.status!=='done'&&x.dates.length>0&&x.dates[x.dates.length-1]<today()}
function card(x){const e=document.createElement('div');e.className='item';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=vehicleName(x);info.append(title);const meta=document.createElement('div');meta.className='vehicle-meta';meta.textContent=vehicleMeta(x);info.append(meta);const p=document.createElement('p');p.textContent=x.job;info.append(p);if(x.notes){const n=document.createElement('p');n.className='muted';n.textContent=x.notes;info.append(n)}const sub=document.createElement('span');sub.className=isLate(x)?'late':'muted';sub.textContent=(x.dates.length?`${x.dates.length} jour(s) : ${labelDate(x.dates[0])}${x.dates.length>1?' → '+labelDate(x.dates[x.dates.length-1]):''}`:'Sans date')+(isLate(x)?' · En retard':'');info.append(sub);const b=document.createElement('button');b.textContent='Modifier';b.onclick=()=>openEditor(x);e.append(info,b);return e}
function renderLists(){const todo=items.filter(x=>x.status==='todo'&&!x.dates.length),late=items.filter(isLate),done=items.filter(x=>x.status==='done');for(const [id,data,empty] of [['todoList',todo,'Aucune intervention sans date.'],['lateList',late,'Aucune intervention en retard.'],['doneList',done,'Aucune intervention terminée.']]){const node=$(id);node.replaceChildren();if(!data.length){const p=document.createElement('p');p.className='muted';p.textContent=empty;node.append(p)}else data.forEach(x=>node.append(card(x)))}$('counts').textContent=`${todo.length} à prévoir · ${late.length} en retard`}
let selectedCalendarDate=today();
function visibleOnDate(x,s){return x.dates.includes(s)&&($('showDone').checked||x.status!=='done')}
function sortedOnDate(s){return items.filter(x=>visibleOnDate(x,s)).sort((a,b)=>vehicleName(a).localeCompare(vehicleName(b),'fr'))}
function calendarEntry(x,compact=false){
 const b=document.createElement('button');b.type='button';b.className=compact?'agenda-entry':'chip';
 if(x.status==='done')b.classList.add('done');else if(isLate(x))b.classList.add('late');
 const title=document.createElement('strong');title.textContent=vehicleName(x);
 const meta=document.createElement('span');meta.textContent=vehicleMeta(x);meta.className='chip-meta';
 const job=document.createElement('span');job.textContent=x.job;job.className='chip-job';
 b.append(title,meta,job);
 if(compact&&x.dates.length>1){const period=document.createElement('small');period.className='muted';period.textContent=`Prévue sur ${x.dates.length} journées (${labelDate(x.dates[0])} – ${labelDate(x.dates.at(-1))})`;b.append(period)}
 b.onclick=e=>{e.stopPropagation();openEditor(x)};
 return b;
}
function cellDate(s,other=false){
 const d=document.createElement('div');d.className='day'+(other?' other':'')+(s===today()?' today':'')+(s===selectedCalendarDate?' selected':'');
 const num=document.createElement('span');num.className='num';num.textContent=parse(s).getDate();d.append(num);
 const relevant=sortedOnDate(s);
 if(calMode==='month'){
  const markers=document.createElement('span');markers.className='month-markers';
  if(relevant.length){const dot=document.createElement('i');dot.className='month-dot';if(relevant.some(isLate))dot.classList.add('late-dot');markers.append(dot);if(relevant.length>1){const count=document.createElement('small');count.textContent=relevant.length;markers.append(count)}}
  d.append(markers);
  d.addEventListener('click',()=>{selectedCalendarDate=s;renderCalendar()});
  d.setAttribute('role','button');d.tabIndex=0;d.setAttribute('aria-label',`${labelDate(s)}, ${relevant.length} intervention(s)`);
  d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectedCalendarDate=s;renderCalendar()}});
 }else{
  d.addEventListener('click',()=>openEditor(null,[s]));
  relevant.forEach(x=>d.append(calendarEntry(x)));
 }
 return d;
}
function renderMonthDetail(){
 const detail=$('calendarDetail');detail.replaceChildren();
 if(calMode!=='month'){detail.classList.add('hidden');return}
 detail.classList.remove('hidden');
 const head=document.createElement('div');head.className='detail-heading';
 const title=document.createElement('strong');title.textContent=parse(selectedCalendarDate).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
 const add=document.createElement('button');add.type='button';add.textContent='+ Intervention';add.onclick=()=>openEditor(null,[selectedCalendarDate]);
 head.append(title,add);detail.append(head);
 const entries=sortedOnDate(selectedCalendarDate);
 if(!entries.length){const p=document.createElement('p');p.className='muted';p.textContent='Aucune intervention pour cette journée.';detail.append(p)}
 else entries.forEach(x=>detail.append(calendarEntry(x,true)));
}
function renderMobileWeek(dates){
 const root=$('weekAgenda');root.replaceChildren();
 if(calMode!=='week'){root.classList.add('hidden');return}
 root.classList.remove('hidden');
 dates.forEach(s=>{
  const relevant=sortedOnDate(s);
  if(!relevant.length)return;
  const group=document.createElement('div');group.className='agenda-day';
  const date=document.createElement('div');date.className='agenda-date';date.textContent=parse(s).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
  const content=document.createElement('div');content.className='agenda-content';
  relevant.forEach(x=>{content.append(calendarEntry(x,true))});
  group.append(date,content);root.append(group);
 });
 if(!root.children.length){const p=document.createElement('p');p.className='muted';p.textContent='Aucune intervention cette semaine.';root.append(p)}
}
function renderCalendar(){
 const c=$('calendar');c.replaceChildren();c.classList.toggle('week',calMode==='week');
 ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(t=>{const e=document.createElement('div');e.className='dayname';e.textContent=t;c.append(e)});
 let dates=[];
 if(calMode==='month'){
  const first=weekStart(calendarMonth),last=monthShift(calendarMonth,1),end=shift(weekStart(last),6);
  for(let d=first;d<=end;d=shift(d,1))dates.push(d);
  $('period').textContent=parse(calendarMonth).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  if(selectedCalendarDate.slice(0,7)!==calendarMonth.slice(0,7))selectedCalendarDate=calendarMonth;
 }else{
  for(let i=0;i<7;i++)dates.push(shift(calendarWeek,i));
  $('period').textContent=`${labelDate(dates[0])} – ${labelDate(dates[6])}`;
 }
 dates.forEach(s=>c.append(cellDate(s,calMode==='month'&&s.slice(0,7)!==calendarMonth.slice(0,7))));
 renderMonthDetail();renderMobileWeek(dates);
}
function render(){renderLists();renderCalendar()}
function setTab(v){tab=v;$('todoView').classList.toggle('hidden',v!=='todo');$('calView').classList.toggle('hidden',v!=='cal');$('tabTodo').classList.toggle('active',v==='todo');$('tabCal').classList.toggle('active',v==='cal');if(v==='cal')renderCalendar()}
let inspectedPickerDate=today();
function renderPickerDetails(){
 const panel=$('pickDetails');panel.replaceChildren();
 const head=document.createElement('strong');head.textContent=parse(inspectedPickerDate).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});panel.append(head);
 const entries=items.filter(x=>x.id!==editing&&x.dates.includes(inspectedPickerDate)&&x.status!=='done');
 if(!entries.length){const note=document.createElement('p');note.className='muted';note.textContent='Aucune intervention planifiée ce jour.';panel.append(note)}
 else entries.forEach(x=>{
  const card=document.createElement('div');card.className='pick-entry';
  const title=document.createElement('strong');title.textContent=vehicleName(x);
  const meta=document.createElement('span');meta.textContent=vehicleMeta(x);
  const job=document.createElement('span');job.textContent=x.job;
  card.append(title,meta,job);panel.append(card);
 });
}
function renderPicker(){
 const grid=$('pickCalendar');grid.replaceChildren();
 $('pickPeriod').textContent=parse(pickMonth).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
 $('pickMode').textContent=pickRange?'Période':'Jours individuels';$('pickMode').classList.toggle('active',pickRange);
 ['L','M','M','J','V','S','D'].forEach(t=>{const n=document.createElement('div');n.className='dayname';n.textContent=t;grid.append(n)});
 const start=weekStart(pickMonth),end=shift(weekStart(monthShift(pickMonth,1)),6);
 for(let s=start;s<=end;s=shift(s,1)){
  const b=document.createElement('button');b.type='button';b.dataset.date=s;b.className='pick-day';
  const n=document.createElement('span');n.textContent=parse(s).getDate();b.append(n);
  const occupied=items.filter(x=>x.id!==editing&&x.status!=='done'&&x.dates.includes(s));
  if(occupied.length){const marker=document.createElement('span');marker.className='pick-marker';marker.textContent=occupied.length>1?String(occupied.length):'●';b.append(marker)}
  b.classList.toggle('sel',selected.includes(s));b.classList.toggle('today',s===today());
  b.classList.toggle('inspected',s===inspectedPickerDate);
  if(s.slice(0,7)!==pickMonth.slice(0,7))b.classList.add('other');
  b.setAttribute('aria-label',`${labelDate(s)}, ${occupied.length} intervention(s)`);
  grid.append(b);
 }
 updateSmsWarning();$('pickedText').textContent=selected.length?`${selected.length} journée(s) : ${selected.map(labelDate).join(', ')}`:'Aucune date sélectionnée';
 renderPickerDetails();
}
function chooseDate(s,drag=false){inspectedPickerDate=s;if(pickRange){if(!pickAnchor){pickAnchor=s;selected=[s]}else{const lo=pickAnchor<s?pickAnchor:s,hi=pickAnchor>s?pickAnchor:s;selected=[];for(let d=lo;d<=hi;d=shift(d,1))selected.push(d);if(!drag)pickAnchor=null}}else{selected=selected.includes(s)?selected.filter(x=>x!==s):unique([...selected,s])}renderPicker()}

function updateSmsWarning(){
 const checked=$('sendSms').checked;
 const number=$('phone').value.trim();
 $('smsWarning').textContent=number?'Numéro invalide : vérifie le téléphone avant d’ouvrir Messages.':'Numéro de téléphone manquant : complète-le pour ouvrir Messages.';
 $('smsWarning').classList.toggle('hidden',!checked||WBPhone.isValid(number));
 $('smsHint').textContent=selected.length?'Notifications push automatiques lors de la planification ou d’un changement de dates.':'Sans date : aucune notification push.';
}
function confirmationSmsText(x){
 const name=[x.brand,x.model].map(v=>String(v||'').trim()).filter(Boolean).join(' ')||'véhicule';
 const plate=String(x.plate||'').trim();
 const dates=unique(x.dates||[]);
 const isConsecutive=dates.length>1&&dates.every((day,i)=>i===0||day===shift(dates[i-1],1));
 const when=dates.length===1?`le ${labelDate(dates[0])}`
   :isConsecutive?`du ${labelDate(dates[0])} au ${labelDate(dates[dates.length-1])}`
   :`les ${dates.map(labelDate).join(', ')}`;
 return `Bonjour,\n\nWheelerBrothers vous confirme l'intervention sur votre ${name}${plate?' ('+plate+')':''}, prévue ${when}.`;
}
function smsText(){
 return confirmationSmsText({brand:$('brand').value,model:$('model').value,plate:$('plate').value,dates:selected});
}
// Le numéro saisi dans la fenêtre SMS est répercuté sur l'intervention
// et sur la fiche correspondante du Carnet (si elle est identifiable).
let smsContext=null,smsBusy=false;
function smsStatus(text='',error=false){
 const el=$('smsSaveStatus');el.textContent=text;
 el.className=error?'error':'muted';
}
function showSmsAction(phone,text,context){
 smsContext={
  itemId:context?.itemId||null,
  plate:String(context?.plate||'').trim(),
  savedPhone:WBPhone.format(context?.savedPhone||''),
  confirmedPhone:null,
  lastResult:null
 };
 $('smsNumber').value=WBPhone.format(phone||'');$('smsBody').value=text;
 $('smsMissing').textContent=phone?'Numéro invalide : vérifie le numéro de téléphone.':'Numéro manquant : renseigne-le avant d’ouvrir Messages.';
 $('smsMissing').classList.toggle('hidden',WBPhone.isValid(phone));
 smsStatus();
 $('smsDialog').showModal();
}
function smsInputPhone(requireNumber){
 const phone=$('smsNumber').value.trim();
 if(!phone&&!requireNumber)return '';
 if(!WBPhone.isValid(phone)){
  $('smsMissing').textContent=phone?'Numéro de téléphone invalide : vérifie la saisie.':'Numéro de téléphone manquant : renseigne-le avant d’ouvrir Messages.';
  $('smsMissing').classList.remove('hidden');$('smsNumber').focus();return null;
 }
 $('smsMissing').classList.add('hidden');
 return WBPhone.format(phone);
}
async function persistSmsPhone(phone){
 if(!phone)return {result:'skipped'};
 if(!smsContext?.itemId||!collection)throw new Error('Intervention introuvable : impossible d’enregistrer le numéro.');
 if(smsContext.confirmedPhone&&WBPhone.same(smsContext.confirmedPhone,phone))return {result:smsContext.lastResult||'unchanged'};
 const id=smsContext.itemId;
 if(!WBPhone.same(smsContext.savedPhone,phone)){
  await collection.doc(id).update({phone,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  smsContext.savedPhone=phone;
 }
 // La mise à jour de la fiche véhicule réutilise la transaction sécurisée
 // créée en v55.3 (doublons, conflit de numéros, modification concurrente).
 const result=await syncPhoneToCarnet(smsContext.plate,phone);
 smsContext.confirmedPhone=phone;
 smsContext.lastResult=result;
 // Le formulaire « Modifier l'intervention » peut rester ouvert derrière
 // cette fenêtre. Sans cette mise à jour, il pourrait écraser le numéro sauvé.
 if(editing===id&&$('editor').open){$('phone').value=phone;updateSmsWarning()}
 return {result};
}
function smsSavedNote(result){
 if(result==='kept')return 'Numéro enregistré dans l’intervention ; le numéro existant du Carnet a été conservé.';
 if(result==='ambiguous')return 'Numéro enregistré dans l’intervention, mais plusieurs fiches correspondent à la plaque. Le Carnet n’a pas été modifié.';
 if(result==='no-match'||result==='skipped')return 'Numéro enregistré dans l’intervention. Aucune fiche véhicule correspondante n’a été mise à jour.';
 return 'Numéro de téléphone enregistré dans l’intervention et le Carnet d’atelier.';
}
async function completeSmsAction(openMessages){
 if(smsBusy)return;
 const phone=smsInputPhone(openMessages);
 if(phone===null)return;
 smsBusy=true;$('smsClose').disabled=true;$('smsOpen').disabled=true;
 smsStatus(phone?'Enregistrement du numéro de téléphone…':'');
 try{
  // Les fonctions d'enregistrement sont attendues AVANT l'ouverture de
  // Messages, pour éviter que le navigateur suspendu interrompe Firestore.
  let result='skipped';
  if(phone){({result}=await persistSmsPhone(phone));smsStatus(smsSavedNote(result))}
  if(!openMessages){
   if(phone)message(smsSavedNote(result),['ambiguous','no-match'].includes(result));
   $('smsDialog').close();smsContext=null;return
  }
  // Sur iOS, une ouverture d'application après un appel réseau asynchrone
  // peut être bloquée : un deuxième tap reste possible, sans nouvelle écriture.
  smsStatus('Numéro enregistré. Si Messages ne s’ouvre pas, touche à nouveau « Ouvrir Messages ».');
  const separator=/iPad|iPhone|iPod/.test(navigator.userAgent)?'&':'?';
  window.location.href='sms:'+WBPhone.dial(phone)+separator+'body='+encodeURIComponent($('smsBody').value);
 }catch(err){
  smsStatus('Numéro non synchronisé : '+err.message+'. Réessaie avant de fermer ou d’ouvrir Messages.',true);
 }finally{smsBusy=false;$('smsClose').disabled=false;$('smsOpen').disabled=false}
}
function closeSmsDialog(){return completeSmsAction(false)}
function openSmsApp(){return completeSmsAction(true)}

// v55.3 — synchronise le téléphone avec la fiche du Carnet d’atelier, sans
// modifier les autres champs ni les opérations du véhicule.
function carnetDataFromSnapshot(snap){
 const data=JSON.parse(snap.data().payload||'{"vehicles":[]}');
 if(!data||!Array.isArray(data.vehicles))throw new Error('Format du Carnet d’atelier invalide.');
 return data;
}
function matchingCarnetVehicles(data,plateKey){
 return data.vehicles.filter(v=>v&&typeof v==='object'&&normalizePlate(v.plate)===plateKey);
}
function samePhone(a,b){return WBPhone.same(a,b)}
async function syncPhoneToCarnet(plate,phone){
 const key=normalizePlate(plate),number=String(phone||'').trim();
 // Ne jamais effacer le numéro d'une fiche lors d'une saisie vide dans le Planning.
 if(!key||!number||!activeSpaceId)return 'skipped';
 const docRef=db.collection('spaces').doc(activeSpaceId).collection('tools').doc('atelier');
 const snapshot=await docRef.get({source:'server'});
 if(!snapshot.exists)return 'no-match';
 const initial=carnetDataFromSnapshot(snapshot);
 const matches=matchingCarnetVehicles(initial,key);
 if(!matches.length)return 'no-match';
 if(matches.length!==1)return 'ambiguous';
 const original=matches[0];
 const current=String(original.phone||original.telephone||'').trim();
 if(samePhone(current,number))return 'unchanged';
 // L'utilisateur garde la possibilité de conserver le numéro du Carnet,
 // tout en utilisant un numéro différent pour cette intervention.
 if(current&&!confirm(`Le Carnet d’atelier contient déjà le numéro ${current} pour ${original.plate||plate}.\n\nLe remplacer par ${number} ?`))return 'kept';
 const vehicleId=original.id;
 let updated=false;
 await db.runTransaction(async tx=>{
  updated=false; // La transaction peut être rejouée en cas d'écriture concurrente.
  const latest=await tx.get(docRef);
  if(!latest.exists)throw new Error('La fiche du Carnet d’atelier n’existe plus.');
  const data=carnetDataFromSnapshot(latest);
  const found=matchingCarnetVehicles(data,key);
  if(found.length!==1||(vehicleId&&found[0].id!==vehicleId)){
   throw new Error('La fiche véhicule a changé pendant l’enregistrement. Vérifie le Carnet d’atelier.');
  }
  const v=found[0];
  const latestPhone=String(v.phone||v.telephone||'').trim();
  if(samePhone(latestPhone,number))return;
  if(!samePhone(latestPhone,current)){
   throw new Error('Le téléphone a été modifié sur un autre appareil. Vérifie la fiche avant de recommencer.');
  }
  v.phone=WBPhone.format(number);
  v.updatedAt=Date.now();
  tx.update(docRef,{payload:JSON.stringify(data),updatedAt:Date.now()});
  updated=true;
 });
 return updated?'updated':'unchanged';
}
async function loadPhoneFromCarnet(plate){
 if(!plate||!activeSpaceId)return '';
 try{
  const snap=await db.collection('spaces').doc(activeSpaceId).collection('tools').doc('atelier').get();
  const data=snap.exists?JSON.parse(snap.data().payload||'{}'):{};
  const found=(data.vehicles||[]).filter(v=>normalizePlate(v.plate)===normalizePlate(plate));
  return found.length===1?String(found[0].phone||found[0].telephone||'').trim():'';
 }catch{return ''}
}
async function sendConfirmationFromCalendar(){
 const x=items.find(v=>v.id===editing);if(!x||!x.dates.length)return;
 let phone=x.phone||await loadPhoneFromCarnet(x.plate);
 showSmsAction(phone,confirmationSmsText(x),{itemId:x.id,plate:x.plate,savedPhone:x.phone});
}

function openEditor(x,dates){editing=x?.id||null;draftPlanningId=editing||('pl_'+crypto.randomUUID().replaceAll('-',''));chosenVehicleId=x?.vehicleId||null;selected=unique(dates||x?.dates||[]);pickAnchor=null;pickRange=false;pickMonth=firstMonth(selected[0]||today());inspectedPickerDate=selected[0]||today();$('editorTitle').textContent=x?'Modifier l’intervention':'Nouvelle intervention';$('otherPlateFormat').checked=isOtherPlateFormat(x?.plate);$('plate').value=x?.plate||'';updatePlateDisplay();$('brand').value=x?.brand||'';$('model').value=x?.model||(!x?.brand?x?.vehicle||'':'');$('owner').value=x?.owner||'';$('phone').value=WBPhone.format(x?.phone||'');$('sendSms').checked=false;updateSmsWarning();lookupRevision++;lookupMessage('');$('job').value=x?.job||'';$('notes').value=x?.notes||'';$('finish').classList.toggle('hidden',!x||x.status==='done');$('reopen').classList.toggle('hidden',!x||x.status!=='done');$('delete').classList.toggle('hidden',!x);$('calendarSms').classList.toggle('hidden',!x||!x.dates.length);$('formError').textContent='';updateSmsWarning();renderPicker();$('editor').showModal();editorFingerprint=formFingerprint();$('planningReport').classList.toggle('hidden',!x);$('planningReport').textContent=x?.reportId?'Ouvrir le rapport':'Créer / associer un rapport';$('editClosure').classList.toggle('hidden',!x||x.status!=='done');$('planningLinkStatus').textContent=x?.operationId?'Liée à une opération du Carnet d’atelier.':x?.dates?.length?'La fiche véhicule et l’opération seront liées au prochain enregistrement.':'';loadKnownVehicles()}
function closeEditor(){$('editor').close()}
function formFingerprint(){return JSON.stringify(['plate','brand','model','owner','phone','job','notes'].map(id=>$(id).value).concat(unique(selected)));}
function requireSavedForm(){if(formFingerprint()!==editorFingerprint){alert('Enregistre d’abord les modifications du formulaire, puis rouvre cette intervention.');return false}return true;}
async function save(ev){
 ev?.preventDefault();if(!collection)return;$('formError').textContent='';
 if(!WBPhone.validOrReport($('phone'))){$('formError').textContent='Vérifie le numéro de téléphone.';return}
 const job=$('job').value.trim();if(!job){$('formError').textContent='Renseigne les travaux prévus.';return}
 const payload={vehicle:[$('brand').value.trim(),$('model').value.trim()].filter(Boolean).join(' '),plate:($('otherPlateFormat').checked?$('plate').value.trim():formatFrenchPlate($('plate').value)),brand:$('brand').value.trim(),model:$('model').value.trim(),owner:$('owner').value.trim(),phone:WBPhone.format($('phone').value),job,notes:$('notes').value.trim(),dates:unique(selected)};
 if(chosenVehicleId)payload.vehicleId=chosenVehicleId;
 $('save').disabled=true;
 try{
  const result=await WBWorkflow.call('savePlanning',{planningId:draftPlanningId,patch:payload});
  const wantsSms=$('sendSms').checked&&payload.dates.length,phone=payload.phone,text=wantsSms?smsText():'';
  closeEditor();
  if(wantsSms)showSmsAction(phone,text,{itemId:result.planningId,plate:payload.plate,savedPhone:phone});
  message(result.warning||'Intervention et Carnet d’atelier enregistrés.',!!result.warning);
 }catch(err){$('formError').textContent='Enregistrement impossible : '+err.message}
 finally{$('save').disabled=false}
}
async function setCompletion(done){
 if(!editing||!collection||!requireSavedForm())return;
 const btn=done?$('finish'):$('reopen');btn.disabled=true;
 try{const result=done?await WBWorkflow.closeOperation({planningId:editing}):await WBWorkflow.reopen({planningId:editing});if(result){closeEditor();message(done?'Intervention terminée · Carnet mis à jour':'Intervention réouverte · Carnet mis à jour');}}
 catch(err){$('formError').textContent='Modification impossible : '+err.message}
 finally{btn.disabled=false}
}
async function remove(){if(!editing||!collection||!confirm('Supprimer cette intervention et son opération liée non terminée ? Un rapport lié doit être détaché au préalable.'))return;try{await WBWorkflow.call('deletePlanning',{planningId:editing});closeEditor()}catch(err){$('formError').textContent=err.message}}
$('planningReport').onclick=async()=>{if(!editing||!requireSavedForm())return;try{await WBWorkflow.reportAction({planningId:editing})}catch(e){$('formError').textContent=e.message}};
$('editClosure').onclick=()=>setCompletion(true);
$('vehicleSearch').addEventListener('input',renderVehicleOptions);$('vehicleSelect').addEventListener('change',selectKnownVehicle);$('lookupVehicle').onclick=lookupVehicle;$('plate').addEventListener('input',()=>{chosenVehicleId=null;updatePlateDisplay();lookupRevision++;lookupMessage('')});$('otherPlateFormat').addEventListener('change',()=>{updatePlateDisplay();lookupRevision++;lookupMessage('')});$('add').onclick=()=>openEditor(null);$('close').onclick=closeEditor;$('cancel').onclick=closeEditor;$('form').onsubmit=save;$('delete').onclick=remove;$('calendarSms').onclick=sendConfirmationFromCalendar;$('sendSms').onchange=updateSmsWarning;WBPhone.bind($('phone'));$('phone').addEventListener('input',updateSmsWarning);WBPhone.bind($('smsNumber'));$('smsOpen').onclick=openSmsApp;$('smsClose').onclick=closeSmsDialog;$('smsDialog').addEventListener('cancel',e=>{e.preventDefault();closeSmsDialog()});$('smsNumber').addEventListener('input',()=>{smsStatus();if(smsContext)smsContext.confirmedPhone=null});$('smsCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('smsBody').value)}catch{alert('Sélectionne le texte pour le copier.')}};$('finish').onclick=()=>setCompletion(true);$('reopen').onclick=()=>setCompletion(false);$('tabTodo').onclick=()=>setTab('todo');$('tabCal').onclick=()=>setTab('cal');$('month').onclick=()=>{calMode='month';$('month').classList.add('active');$('week').classList.remove('active');renderCalendar()};$('week').onclick=()=>{calMode='week';$('week').classList.add('active');$('month').classList.remove('active');renderCalendar()};$('prev').onclick=()=>{if(calMode==='month')calendarMonth=monthShift(calendarMonth,-1);else calendarWeek=shift(calendarWeek,-7);renderCalendar()};$('next').onclick=()=>{if(calMode==='month')calendarMonth=monthShift(calendarMonth,1);else calendarWeek=shift(calendarWeek,7);renderCalendar()};$('today').onclick=()=>{calendarMonth=firstMonth(today());calendarWeek=weekStart(today());renderCalendar()};$('showDone').onchange=renderCalendar;$('pickPrev').onclick=()=>{pickMonth=monthShift(pickMonth,-1);renderPicker()};$('pickNext').onclick=()=>{pickMonth=monthShift(pickMonth,1);renderPicker()};$('pickMode').onclick=()=>{pickRange=!pickRange;pickAnchor=null;renderPicker()};$('clearDates').onclick=()=>{selected=[];pickAnchor=null;renderPicker()};
// Pointer events support finger drag for contiguous ranges; individual tapping for noncontiguous days.
const picker=$('pickCalendar');let dragged=false;
picker.addEventListener('pointerdown',e=>{const b=e.target.closest('button[data-date]');if(!b||!pickRange)return;pointerDown=true;dragStart=b.dataset.date;dragged=false});
picker.addEventListener('pointermove',e=>{if(!pointerDown||!pickRange||!dragStart)return;const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('button[data-date]');if(!b||b.dataset.date===dragStart&&!dragged)return;dragged=true;const lo=dragStart<b.dataset.date?dragStart:b.dataset.date,hi=dragStart>b.dataset.date?dragStart:b.dataset.date;selected=[];for(let d=lo;d<=hi;d=shift(d,1))selected.push(d);renderPicker()});
window.addEventListener('pointerup',()=>{if(pointerDown){pointerDown=false;if(dragged){pickAnchor=null;setTimeout(()=>{dragged=false},0)}dragStart=null}});
picker.addEventListener('click',e=>{const b=e.target.closest('button[data-date]');if(!b||dragged)return;chooseDate(b.dataset.date)});


let messaging=null;
async function activatePush(){
 const label=$('pushStatus');
 if(!('serviceWorker' in navigator)||!('Notification' in window)||!firebase.messaging?.isSupported){label.textContent='Notifications non prises en charge sur cet appareil.';return}
 const vapid=window.WB_PUSH_VAPID_KEY||'';
 if(!vapid||vapid.startsWith('REMPLACER')){label.textContent='Configuration Firebase : clé VAPID manquante.';return}
 try{
  const permission=await Notification.requestPermission();
  if(permission!=='granted'){label.textContent='Notifications non autorisées.';return}
  const registration=await navigator.serviceWorker.register('sw.js?v=56',{updateViaCache:'none'});
  messaging=firebase.messaging();
  const token=await messaging.getToken({vapidKey:vapid,serviceWorkerRegistration:registration});
  if(!token)throw Error('Aucun jeton de notification obtenu');
  const id=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const key=Array.from(new Uint8Array(id)).map(b=>b.toString(16).padStart(2,'0')).join('');
  await db.collection('spaces').doc(activeSpaceId).collection('planningPushDevices').doc(key).set({token,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),userAgent:navigator.userAgent.slice(0,220)}, {merge:true});
  label.textContent='Notifications activées sur cet appareil.';
  messaging.onMessage(payload=>{label.textContent=payload.notification?.title||'Nouvelle notification Planning';});
 }catch(err){label.textContent='Activation impossible : '+err.message}
}
$('enablePush').onclick=activatePush;

window.atelierReady.then(({spaceId})=>{activeSpaceId=spaceId;document.querySelectorAll('[data-firebase-status]').forEach(e=>{e.classList.add('is-connected');e.classList.remove('is-disconnected')});collection=db.collection('spaces').doc(spaceId).collection('planningItems');unsubscribe=collection.onSnapshot(snapshot=>{items=snapshot.docs.map(doc=>{const x=doc.data();return{id:doc.id,vehicleId:x.vehicleId||null,operationId:x.operationId||null,reportId:x.reportId||null,vehicle:String(x.vehicle||''),plate:String(x.plate||''),brand:String(x.brand||''),model:String(x.model||''),owner:String(x.owner||''),phone:String(x.phone||''),job:String(x.job||''),notes:String(x.notes||''),status:['todo','planned','done'].includes(x.status)?x.status:'todo',dates:unique(Array.isArray(x.dates)?x.dates:[])}});items.sort((a,b)=>a.job.localeCompare(b.job,'fr'));message('Planning synchronisé avec Firebase');render();if($('editor').open)renderPicker()},err=>message('Accès au planning refusé : '+err.message,true))}).catch(err=>message('Connexion impossible : '+err.message,true));
render();
})();
