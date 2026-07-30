'use strict';

/*
 * Extension non intrusive du Carnet d'atelier existant.
 * Elle ajoute le partage WB Carnet, sans modifier les rapports ni l'inventaire.
 */
(function(){
  const VERSION = '3.1';
  const CLIENT_URL = 'https://tdyfa.github.io/wheelerBrothers-carnet/';
  const INVITE_MS = 24 * 60 * 60 * 1000;
  const COLLECTIONS = {
    users: 'wbCarnetUsers',
    vehicles: 'wbCarnetVehicles',
    invitations: 'wbCarnetInvitations'
  };

  if(typeof firebase === 'undefined' || typeof db === 'undefined'){
    console.error('WB Carnet Pro : Firebase non disponible.');
    return;
  }
  if(!firebase.auth){
    console.error("WB Carnet Pro : le module Firebase Authentication n'est pas chargé.");
    return;
  }

  const auth = firebase.auth();
  auth.languageCode = 'fr';
  const originalSaveData = typeof window.saveData === 'function' ? window.saveData.bind(window) : null;
  let recaptcha = null;
  let syncTimer = null;
  let currentPanelVehicleId = null;
  let currentPanelElement = null;
  let accessUnsubs = [];
  let authWaiter = null;
  let renderingPanel = false;

  function serverTimestamp(){ return firebase.firestore.FieldValue.serverTimestamp(); }
  function timestamp(ms){ return firebase.firestore.Timestamp.fromMillis(ms); }
  function escapeHtml(value){
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }
  function normalizePlate(value){ return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,''); }
  function normalizePhone(value){
    let phone = String(value || '').trim().replace(/[\s.()-]/g,'');
    if(phone.startsWith('0033')) phone = '+33' + phone.slice(4);
    if(phone.startsWith('33') && !phone.startsWith('+')) phone = '+' + phone;
    if(phone.startsWith('0')) phone = '+33' + phone.slice(1);
    if(!/^\+33[67]\d{8}$/.test(phone)) throw new Error('Saisis un numéro mobile français valide (06 ou 07).');
    return phone;
  }
  function formatPhone(value){
    const match = String(value || '').match(/^\+33([1-9])(\d{2})(\d{2})(\d{2})(\d{2})$/);
    return match ? `0${match[1]} ${match[2]} ${match[3]} ${match[4]} ${match[5]}` : String(value || '');
  }
  function toMillis(value){
    if(!value) return 0;
    if(typeof value.toMillis === 'function') return value.toMillis();
    return Number(value) || new Date(value).getTime() || 0;
  }
  function formatDateTime(value){
    const ms = toMillis(value);
    return ms ? new Date(ms).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
  }
  function randomToken(){
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  function safeOperationId(id){
    const raw = String(id || '').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
    return `atelier_${raw || randomToken().slice(0,24)}`;
  }
  function workshopData(){
    return typeof DATA !== 'undefined' && DATA ? DATA : {vehicles:[]};
  }
  function selectedVehicleId(){
    return typeof currentVehicleId !== 'undefined' ? currentVehicleId : null;
  }
  function currentVehicle(){
    return (workshopData().vehicles || []).find(vehicle=>vehicle.id === selectedVehicleId()) || null;
  }
  function vehicleRef(id){ return db.collection(COLLECTIONS.vehicles).doc(id); }
  function memberRef(vehicleId,uid){ return vehicleRef(vehicleId).collection('members').doc(uid); }
  function userRef(uid){ return db.collection(COLLECTIONS.users).doc(uid); }
  function userVehicleRef(uid,vehicleId){ return userRef(uid).collection('vehicles').doc(vehicleId); }
  function inviteRef(token){ return db.collection(COLLECTIONS.invitations).doc(token); }
  function inviteLink(token){ return `${CLIENT_URL.replace(/\/?$/,'/')}?invite=${encodeURIComponent(token)}`; }
  function inviteStatus(invite){
    if(!invite) return 'unknown';
    if(invite.status === 'pending' && toMillis(invite.expiresAt) <= Date.now()) return 'expired';
    return invite.status || 'unknown';
  }
  function statusLabel(status){
    return ({pending:'Invitation en attente',used:'Accès actif',cancelled:'Invitation annulée',revoked:'Accès révoqué',expired:'Invitation expirée'})[status] || 'État inconnu';
  }
  function firebaseMessage(error){
    const code = error?.code || '';
    if(code.includes('invalid-phone-number')) return 'Le numéro de téléphone est invalide.';
    if(code.includes('too-many-requests')) return 'Trop de demandes ont été effectuées. Réessaie plus tard.';
    if(code.includes('quota-exceeded')) return 'Le quota de SMS Firebase est atteint.';
    if(code.includes('billing-not-enabled')) return 'La facturation Firebase doit être activée pour envoyer les SMS.';
    if(code.includes('operation-not-allowed')) return "L'authentification par téléphone n'est pas activée dans Firebase.";
    if(code.includes('unauthorized-domain')) return "Le domaine n'est pas autorisé dans Firebase Authentication.";
    if(code.includes('invalid-verification-code')) return 'Le code saisi est incorrect.';
    if(code.includes('code-expired')) return 'Le code a expiré. Demande un nouveau SMS.';
    if(code.includes('permission-denied')) return "Ce compte n'est pas autorisé à gérer ce partage.";
    return error?.message || 'Une erreur est survenue.';
  }

  function closeAccessListeners(){
    accessUnsubs.forEach(unsub=>{ try{unsub();}catch(_e){} });
    accessUnsubs = [];
    currentPanelVehicleId = null;
    currentPanelElement = null;
  }

  function closeModal(){
    document.getElementById('wbcProOverlay')?.remove();
    try{ recaptcha?.clear(); }catch(_e){}
    recaptcha = null;
  }

  function modal(title,description,body){
    closeModal();
    const overlay = document.createElement('div');
    overlay.id = 'wbcProOverlay';
    overlay.className = 'wbc-pro-overlay';
    overlay.innerHTML = `<section class="wbc-pro-modal" role="dialog" aria-modal="true"><div class="wbc-pro-modal-head"><div><h2>${escapeHtml(title)}</h2>${description?`<p>${escapeHtml(description)}</p>`:''}</div><button class="wbc-pro-close" type="button" aria-label="Fermer">×</button></div><div class="wbc-pro-modal-body">${body}</div></section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.wbc-pro-close').addEventListener('click',closeModal);
    overlay.addEventListener('click',event=>{ if(event.target === overlay) closeModal(); });
    return overlay;
  }

  async function writeOwnProfile(){
    /* Le compte atelier utilise l'authentification e-mail et n'est pas un compte WB Carnet classique. */
    return;
  }

  function signInModal(){
    return new Promise((resolve,reject)=>{
      authWaiter = {resolve,reject};
      const overlay = modal('Connexion WB Carnet','Cette connexion sert uniquement à sécuriser la création et la gestion des accès. Le numéro est traité par Firebase/Google pour la vérification et la prévention des abus.',`
        <form id="wbcPhoneForm"><div class="field"><label for="wbcAdminPhone">Ton numéro de téléphone</label><input type="tel" id="wbcAdminPhone" inputmode="tel" autocomplete="tel" placeholder="06 12 34 56 78" required></div><button class="btn block" id="wbcSendCode" type="submit">Recevoir mon code</button><div class="wbc-pro-status" id="wbcAuthStatus"></div></form>
        <form id="wbcCodeForm" style="display:none"><div class="field"><label for="wbcAdminCode">Code reçu par SMS</label><input type="text" id="wbcAdminCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></div><button class="btn block" id="wbcConfirmCode" type="submit">Valider le code</button><div class="wbc-pro-status" id="wbcCodeStatus"></div></form>
        <div id="wbcRecaptcha"></div>`);
      const phoneForm = overlay.querySelector('#wbcPhoneForm');
      const codeForm = overlay.querySelector('#wbcCodeForm');
      let confirmation = null;
      phoneForm.addEventListener('submit',async event=>{
        event.preventDefault();
        const status=overlay.querySelector('#wbcAuthStatus');const button=overlay.querySelector('#wbcSendCode');
        status.className='wbc-pro-status';status.textContent='Envoi du SMS…';button.disabled=true;
        try{
          const phone=normalizePhone(overlay.querySelector('#wbcAdminPhone').value);
          recaptcha = new firebase.auth.RecaptchaVerifier('wbcRecaptcha',{size:'invisible'});
          confirmation = await auth.signInWithPhoneNumber(phone,recaptcha);
          phoneForm.style.display='none';codeForm.style.display='block';overlay.querySelector('#wbcAdminCode').focus();
        }catch(error){
          status.className='wbc-pro-status err';status.textContent=firebaseMessage(error);button.disabled=false;
          try{recaptcha?.clear();}catch(_e){} recaptcha=null;
        }
      });
      codeForm.addEventListener('submit',async event=>{
        event.preventDefault();
        const status=overlay.querySelector('#wbcCodeStatus');const button=overlay.querySelector('#wbcConfirmCode');
        status.className='wbc-pro-status';status.textContent='Vérification…';button.disabled=true;
        try{
          if(!confirmation) throw new Error('Demande un nouveau code.');
          await confirmation.confirm(overlay.querySelector('#wbcAdminCode').value.trim());
          await writeOwnProfile();
          closeModal();
          authWaiter?.resolve(auth.currentUser);authWaiter=null;
        }catch(error){ status.className='wbc-pro-status err';status.textContent=firebaseMessage(error);button.disabled=false; }
      });
      const rejectAuth=()=>{ authWaiter?.reject(new Error('Connexion annulée.'));authWaiter=null; };
      overlay.querySelector('.wbc-pro-close').addEventListener('click',rejectAuth,{once:true});
      overlay.addEventListener('click',event=>{ if(event.target===overlay) rejectAuth(); },{once:true});
    });
  }

  async function ensureSignedIn(){
    await window.atelierReady;
    const user = auth.currentUser;
    if(!user || user.uid !== ATELIER_ADMIN_UID){
      throw new Error("Le compte atelier unique n'est pas connecté.");
    }
    return user;
  }

  async function saveProOnly(){
    if(!originalSaveData) throw new Error("La sauvegarde du carnet d'atelier n'est pas disponible.");
    const ok = await originalSaveData();
    if(!ok) throw new Error("La fiche atelier n'a pas pu être enregistrée.");
  }

  async function linkVehicle(vehicle){
    const user = await ensureSignedIn();
    if(vehicle.wbCarnet?.vehicleId) return vehicle.wbCarnet.vehicleId;
    if(!normalizePlate(vehicle.plate)) throw new Error("Renseigne l'immatriculation avant de partager la fiche.");
    const ref = db.collection(COLLECTIONS.vehicles).doc();
    const batch = db.batch();
    const plateKey = normalizePlate(vehicle.plate);
    batch.set(ref,{
      model:vehicle.modele || 'Véhicule',engine:vehicle.motorisation || '',plate:vehicle.plate || '',plateKey,
      ownerName:vehicle.owner || '',origin:'atelier',status:'active',sourceVehicleId:vehicle.id,
      createdBy:user.uid,mergedInto:null,mergedFrom:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
    batch.set(memberRef(ref.id,user.uid),{
      uid:user.uid,phone:'',role:'atelier_admin',status:'active',activatedAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
    batch.set(userVehicleRef(user.uid,ref.id),{
      uid:user.uid,vehicleId:ref.id,role:'atelier_admin',status:'active',plateKey,addedAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
    await batch.commit();
    vehicle.wbCarnet={vehicleId:ref.id,phones:[],createdAt:Date.now()};
    await saveProOnly();
    await syncVehicle(vehicle);
    return ref.id;
  }

  async function assertAtelierAdmin(vehicleId){
    const user = await ensureSignedIn();
    const snap = await memberRef(vehicleId,user.uid).get();
    if(!snap.exists || snap.data().status !== 'active' || snap.data().role !== 'atelier_admin'){
      throw new Error("Le numéro connecté n'est pas l'administrateur WheelerBrothers de cette fiche.");
    }
    return user;
  }

  async function commitChunks(actions){
    for(let i=0;i<actions.length;i+=400){
      const batch=db.batch();
      actions.slice(i,i+400).forEach(action=>action(batch));
      await batch.commit();
    }
  }

  async function syncVehicle(vehicle){
    const vehicleId = vehicle?.wbCarnet?.vehicleId;
    if(!vehicleId || !auth.currentUser) return;
    await assertAtelierAdmin(vehicleId);
    const ref=vehicleRef(vehicleId);
    await ref.update({
      model:vehicle.modele || 'Véhicule',engine:vehicle.motorisation || '',plate:vehicle.plate || '',plateKey:normalizePlate(vehicle.plate),
      ownerName:vehicle.owner || '',sourceVehicleId:vehicle.id,updatedAt:serverTimestamp()
    });
    const existingSnap=await ref.collection('operations').get();
    const existingAtelier=new Map(existingSnap.docs.filter(doc=>doc.data().source==='atelier' && doc.data().sourceVehicleId===vehicle.id).map(doc=>[doc.id,doc]));
    const keep=new Set();const actions=[];
    for(const operation of (vehicle.ops || [])){
      const id=safeOperationId(operation.id);keep.add(id);
      actions.push(batch=>batch.set(ref.collection('operations').doc(id),{
        source:'atelier',sourceVehicleId:vehicle.id,sourceOperationId:String(operation.id || ''),
        date:operation.date || '',mileage:Number(operation.km) || null,title:operation.operation || 'Intervention',
        details:operation.notes || '',performedBy:'WheelerBrothers',createdBy:auth.currentUser.uid,
        updatedAt:serverTimestamp(),createdAt:existingAtelier.has(id)?(existingAtelier.get(id).data().createdAt || serverTimestamp()):serverTimestamp()
      },{merge:true}));
    }
    for(const [id] of existingAtelier){ if(!keep.has(id)) actions.push(batch=>batch.delete(ref.collection('operations').doc(id))); }
    if(actions.length) await commitChunks(actions);
  }

  function scheduleSyncAll(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(async()=>{
      const linked=(workshopData().vehicles || []).filter(vehicle=>vehicle.wbCarnet?.vehicleId);
      for(const vehicle of linked){
        try{ await syncVehicle(vehicle); }
        catch(error){ console.warn('Synchronisation WB Carnet',vehicle.id,error); }
      }
      renderPanel();
    },500);
  }

  if(originalSaveData){
    window.saveData = async function(){
      const ok = await originalSaveData();
      if(ok) scheduleSyncAll();
      return ok;
    };
  }

  async function createInvitation(vehicle,phone){
    const vehicleId=await linkVehicle(vehicle);
    const user=await assertAtelierAdmin(vehicleId);
    const token=randomToken();
    const data={
      vehicleId,phone,role:'member',status:'pending',model:vehicle.modele || 'Véhicule',engine:vehicle.motorisation || '',
      plate:vehicle.plate || '',plateKey:normalizePlate(vehicle.plate),ownerName:vehicle.owner || '',createdBy:user.uid,
      createdAt:serverTimestamp(),updatedAt:serverTimestamp(),expiresAt:timestamp(Date.now()+INVITE_MS),usedByUid:null,usedAt:null
    };
    await inviteRef(token).set(data);
    vehicle.wbCarnet = vehicle.wbCarnet || {vehicleId,phones:[]};
    vehicle.wbCarnet.phones = Array.isArray(vehicle.wbCarnet.phones) ? vehicle.wbCarnet.phones : [];
    const local=vehicle.wbCarnet.phones.find(item=>item.phone===phone);
    if(local) Object.assign(local,{phone,lastInvitationToken:token,updatedAt:Date.now()});
    else vehicle.wbCarnet.phones.push({phone,lastInvitationToken:token,createdAt:Date.now(),updatedAt:Date.now()});
    await saveProOnly();
    return {id:token,...data};
  }

  function invitationMessage(vehicle,token){
    return `Bonjour, voici l’accès au carnet d’entretien WB Carnet pour ${vehicle.modele || 'votre véhicule'}${vehicle.plate?` (${vehicle.plate})`:''}. Le lien est valable 24 heures : ${inviteLink(token)}`;
  }
  function openSms(phone,message){
    const separator=/iPhone|iPad|iPod/i.test(navigator.userAgent)?'&':'?';
    location.href=`sms:${encodeURIComponent(phone)}${separator}body=${encodeURIComponent(message)}`;
  }

  function openInviteModal(vehicle,presetPhone=''){
    const overlay=modal('Inviter un proche','Le numéro sera enregistré dans cette fiche atelier et verrouillé dans le lien. L’invitation expirera après 24 heures.',`
      <form id="wbcInviteForm"><div class="field"><label for="wbcInvitePhone">Numéro du proche</label><input type="tel" id="wbcInvitePhone" inputmode="tel" value="${escapeHtml(formatPhone(presetPhone))}" placeholder="06 12 34 56 78" required></div><div class="wbc-pro-actions"><button class="btn" id="wbcCreateInvite" type="submit">Créer et ouvrir Messages</button><button class="btn ghost" id="wbcInviteCancel" type="button">Annuler</button></div><div class="wbc-pro-status" id="wbcInviteStatus"></div></form>`);
    overlay.querySelector('#wbcInviteCancel').addEventListener('click',closeModal);
    overlay.querySelector('#wbcInviteForm').addEventListener('submit',async event=>{
      event.preventDefault();const status=overlay.querySelector('#wbcInviteStatus');const button=overlay.querySelector('#wbcCreateInvite');
      status.className='wbc-pro-status';status.textContent='Création de l’invitation…';button.disabled=true;
      try{
        const phone=normalizePhone(overlay.querySelector('#wbcInvitePhone').value);
        const invite=await createInvitation(vehicle,phone);
        status.className='wbc-pro-status ok';status.innerHTML=`Invitation créée. <button class="btn ghost wbc-pro-small" id="wbcCopyNew" type="button">Copier le lien</button>`;
        overlay.querySelector('#wbcCopyNew').addEventListener('click',()=>copyText(inviteLink(invite.id)));
        openSms(phone,invitationMessage(vehicle,invite.id));
        renderPanel();
      }catch(error){status.className='wbc-pro-status err';status.textContent=firebaseMessage(error);button.disabled=false;}
    });
  }

  async function copyText(text){
    try{ await navigator.clipboard.writeText(text); alert('Lien copié.'); }
    catch(_error){ prompt('Copie ce lien :',text); }
  }

  async function cancelInvitation(token){
    if(!confirm('Annuler cette invitation ?')) return;
    await inviteRef(token).update({status:'cancelled',cancelledAt:serverTimestamp(),updatedAt:serverTimestamp()});
  }

  async function revokeMember(vehicleId,member){
    if(!confirm(`Retirer à ${formatPhone(member.phone)} l’accès à cette fiche uniquement ?`)) return;
    const batch=db.batch();
    batch.update(memberRef(vehicleId,member.id),{status:'revoked',revokedAt:serverTimestamp(),revokedBy:auth.currentUser.uid,updatedAt:serverTimestamp()});
    batch.delete(userVehicleRef(member.id,vehicleId));
    await batch.commit();
    const invites=await db.collection(COLLECTIONS.invitations).where('vehicleId','==',vehicleId).get();
    const updates=[];
    invites.docs.forEach(doc=>{ if(doc.data().usedByUid===member.id) updates.push(batch2=>batch2.update(doc.ref,{status:'revoked',revokedAt:serverTimestamp(),revokedBy:auth.currentUser.uid,updatedAt:serverTimestamp()})); });
    if(updates.length) await commitChunks(updates);
  }

  async function disableCarnetAccount(member){
    const user=await ensureSignedIn();
    const phone=formatPhone(member.phone);
    const confirmed=confirm(
      `Désactiver entièrement le compte WB Carnet de ${phone} ?\n\n` +
      `Cette personne perdra l’accès à tous ses véhicules et ne pourra plus créer de fiche ni d’opération. ` +
      `Une nouvelle invitation créée depuis WheelerBrothers pourra réactiver son compte.`
    );
    if(!confirmed) return;

    const uid=member.id;
    const [pointersSnap,invitesSnap]=await Promise.all([
      userRef(uid).collection('vehicles').get(),
      db.collection(COLLECTIONS.invitations).where('usedByUid','==',uid).get()
    ]);

    const actions=[];
    actions.push(batch=>batch.set(userRef(uid),{
      uid,
      phone:member.phone || '',
      status:'disabled',
      disabledAt:serverTimestamp(),
      disabledBy:user.uid,
      updatedAt:serverTimestamp()
    },{merge:true}));

    pointersSnap.docs.forEach(pointerDoc=>{
      const vehicleId=pointerDoc.id;
      actions.push(batch=>batch.set(memberRef(vehicleId,uid),{
        uid,
        phone:member.phone || '',
        status:'revoked',
        revokedAt:serverTimestamp(),
        revokedBy:user.uid,
        updatedAt:serverTimestamp()
      },{merge:true}));
      actions.push(batch=>batch.delete(pointerDoc.ref));
    });

    invitesSnap.docs.forEach(inviteDoc=>{
      actions.push(batch=>batch.update(inviteDoc.ref,{
        status:'revoked',
        revokedAt:serverTimestamp(),
        revokedBy:user.uid,
        updatedAt:serverTimestamp()
      }));
    });

    await commitChunks(actions);
    alert(`Le compte WB Carnet de ${phone} est désactivé.`);
  }

  function panelContainer(){
    const main=document.getElementById('main');
    const vehicle=currentVehicle();
    if(!main || !vehicle || document.getElementById('wbcProPanel')) return null;
    const profile=main.querySelector('.vehicle-profile');
    if(!profile) return null;
    const panel=document.createElement('section');panel.id='wbcProPanel';panel.className='wbc-pro-panel';
    const actions=main.querySelector('.vehicle-actions');
    if(actions) actions.insertAdjacentElement('afterend',panel); else profile.insertAdjacentElement('afterend',panel);
    return panel;
  }

  async function startAccessListeners(vehicle,panel){
    const vehicleId=vehicle.wbCarnet?.vehicleId;
    if(!vehicleId) return;
    if(currentPanelVehicleId===vehicleId && currentPanelElement===panel && document.body.contains(panel)) return;
    closeAccessListeners();currentPanelVehicleId=vehicleId;currentPanelElement=panel;
    const snapshots={members:[],invites:[]};
    const redraw=()=>drawLinkedPanel(vehicle,panel,snapshots.members,snapshots.invites);
    accessUnsubs.push(vehicleRef(vehicleId).collection('members').onSnapshot(snap=>{snapshots.members=snap.docs.map(doc=>({id:doc.id,...doc.data()}));redraw();},error=>drawPanelError(panel,error)));
    accessUnsubs.push(db.collection(COLLECTIONS.invitations).where('vehicleId','==',vehicleId).onSnapshot(snap=>{snapshots.invites=snap.docs.map(doc=>({id:doc.id,...doc.data()}));redraw();},error=>drawPanelError(panel,error)));
  }

  function drawPanelError(panel,error){
    const status=panel?.querySelector('.wbc-pro-status');if(status){status.className='wbc-pro-status err';status.textContent=firebaseMessage(error);}
  }

  function drawLinkedPanel(vehicle,panel,members,invites){
    if(!panel || !document.body.contains(panel)) return;
    const user=auth.currentUser;
    const admin=Boolean(user && user.uid===ATELIER_ADMIN_UID);
    const people=members.filter(member=>member.status==='active' && member.role!=='atelier_admin');
    const pending=invites.filter(invite=>inviteStatus(invite)==='pending').sort((a,b)=>toMillis(b.createdAt)-toMillis(a.createdAt));
    const recentOther=invites.filter(invite=>inviteStatus(invite)!=='pending' && inviteStatus(invite)!=='used').sort((a,b)=>toMillis(b.createdAt)-toMillis(a.createdAt)).slice(0,4);
    const activeHtml=people.map(member=>`<div class="wbc-pro-access"><div class="wbc-pro-access-main"><div class="wbc-pro-phone">${escapeHtml(formatPhone(member.phone))}</div><div class="wbc-pro-meta">Accès actif${member.activatedAt?` depuis le ${escapeHtml(formatDateTime(member.activatedAt))}`:''}</div></div><div class="wbc-pro-access-actions"><span class="wbc-pro-badge ok">Actif</span><button class="btn danger-outline wbc-pro-small" data-wbc-revoke="${escapeHtml(member.id)}" type="button">Retirer cette fiche</button><button class="btn danger wbc-pro-small" data-wbc-disable-account="${escapeHtml(member.id)}" type="button">Désactiver le compte</button></div></div>`).join('');
    const pendingHtml=pending.map(invite=>`<div class="wbc-pro-access"><div class="wbc-pro-access-main"><div class="wbc-pro-phone">${escapeHtml(formatPhone(invite.phone))}</div><div class="wbc-pro-meta">Expire le ${escapeHtml(formatDateTime(invite.expiresAt))}</div></div><div class="wbc-pro-access-actions"><span class="wbc-pro-badge wait">En attente</span><button class="btn ghost wbc-pro-small" data-wbc-copy="${escapeHtml(invite.id)}" type="button">Copier</button><button class="btn danger-outline wbc-pro-small" data-wbc-cancel="${escapeHtml(invite.id)}" type="button">Annuler</button></div></div>`).join('');
    const otherHtml=recentOther.map(invite=>{const status=inviteStatus(invite);return `<div class="wbc-pro-access"><div class="wbc-pro-access-main"><div class="wbc-pro-phone">${escapeHtml(formatPhone(invite.phone))}</div><div class="wbc-pro-meta">${escapeHtml(statusLabel(status))}</div></div><div class="wbc-pro-access-actions"><span class="wbc-pro-badge ${status==='revoked'?'err':''}">${escapeHtml(statusLabel(status))}</span><button class="btn ghost wbc-pro-small" data-wbc-resend="${escapeHtml(invite.phone)}" type="button">Renvoyer</button></div></div>`}).join('');
    panel.innerHTML=`<div class="wbc-pro-head"><div><h3>Accès WB Carnet</h3><p>Partage du carnet commun de ce véhicule</p></div><span class="wbc-pro-badge ok">Fiche liée</span></div><div class="wbc-pro-body"><div class="wbc-pro-grid"><div><span>Propriétaire transmis</span><strong>${escapeHtml(vehicle.owner || 'Non renseigné')}</strong></div><div><span>Immatriculation</span><strong>${escapeHtml(vehicle.plate || 'Non renseignée')}</strong></div></div>${admin?`<div class="wbc-pro-actions"><button class="btn wbc-pro-small" id="wbcInviteButton" type="button">Inviter un proche</button><button class="btn ghost wbc-pro-small" id="wbcSyncButton" type="button">Synchroniser les opérations</button></div><div class="wbc-pro-list">${activeHtml}${pendingHtml}${otherHtml}${!activeHtml&&!pendingHtml&&!otherHtml?'<p class="wbc-pro-note">Aucun proche n’a encore accès à cette fiche.</p>':''}</div><div class="wbc-pro-status">${people.length?`${people.length} accès actif${people.length>1?'s':''}.`:''} Les opérations WheelerBrothers sont partagées sans temps passé ni rémunération.</div>`:`<p class="wbc-pro-note">Reconnecte-toi avec le code atelier depuis l’accueil WheelerBrothers.</p><button class="btn wbc-pro-small" id="wbcReconnect" type="button">Retour à l’accueil</button><div class="wbc-pro-status"></div>`}</div>`;
    panel.querySelector('#wbcInviteButton')?.addEventListener('click',()=>openInviteModal(vehicle));
    panel.querySelector('#wbcSyncButton')?.addEventListener('click',async event=>{const status=panel.querySelector('.wbc-pro-status');event.currentTarget.disabled=true;status.textContent='Synchronisation…';try{await syncVehicle(vehicle);status.className='wbc-pro-status ok';status.textContent='Fiche et opérations synchronisées.';}catch(error){status.className='wbc-pro-status err';status.textContent=firebaseMessage(error);}finally{event.currentTarget.disabled=false;}});
    panel.querySelector('#wbcReconnect')?.addEventListener('click',()=>{ location.href='index.html'; });
    panel.querySelectorAll('[data-wbc-revoke]').forEach(button=>button.addEventListener('click',async()=>{const member=people.find(item=>item.id===button.dataset.wbcRevoke);if(member)try{await revokeMember(vehicle.wbCarnet.vehicleId,member);}catch(error){alert(firebaseMessage(error));}}));
    panel.querySelectorAll('[data-wbc-disable-account]').forEach(button=>button.addEventListener('click',async()=>{const member=people.find(item=>item.id===button.dataset.wbcDisableAccount);if(member)try{await disableCarnetAccount(member);}catch(error){alert(firebaseMessage(error));}}));
    panel.querySelectorAll('[data-wbc-copy]').forEach(button=>button.addEventListener('click',()=>copyText(inviteLink(button.dataset.wbcCopy))));
    panel.querySelectorAll('[data-wbc-cancel]').forEach(button=>button.addEventListener('click',async()=>{try{await cancelInvitation(button.dataset.wbcCancel);}catch(error){alert(firebaseMessage(error));}}));
    panel.querySelectorAll('[data-wbc-resend]').forEach(button=>button.addEventListener('click',()=>openInviteModal(vehicle,button.dataset.wbcResend)));
  }

  function drawUnlinkedPanel(vehicle,panel){
    panel.innerHTML=`<div class="wbc-pro-head"><div><h3>Accès WB Carnet</h3><p>Partager cette fiche avec un ou plusieurs proches</p></div><span class="wbc-pro-badge">Non partagé</span></div><div class="wbc-pro-body"><div class="wbc-pro-grid"><div><span>Propriétaire</span><strong>${escapeHtml(vehicle.owner || 'Non renseigné')}</strong></div><div><span>Immatriculation</span><strong>${escapeHtml(vehicle.plate || 'Non renseignée')}</strong></div></div><p class="wbc-pro-note">La création du premier lien copiera la fiche et les opérations dans WB Carnet. Le temps passé et la rémunération ne seront jamais transmis.</p><button class="btn wbc-pro-small" id="wbcFirstInvite" type="button">Partager avec un proche</button><div class="wbc-pro-status"></div></div>`;
    panel.querySelector('#wbcFirstInvite').addEventListener('click',()=>openInviteModal(vehicle));
  }

  function renderPanel(){
    if(renderingPanel) return;
    renderingPanel=true;
    requestAnimationFrame(async()=>{
      try{
        const vehicle=currentVehicle();
        if(!vehicle){closeAccessListeners();return;}
        let panel=document.getElementById('wbcProPanel') || panelContainer();
        if(!panel) return;
        if(!vehicle.wbCarnet?.vehicleId){closeAccessListeners();drawUnlinkedPanel(vehicle,panel);return;}
        const vehicleId=vehicle.wbCarnet.vehicleId;
        const listenersAlreadyActive=(
          currentPanelVehicleId===vehicleId
          && currentPanelElement===panel
          && document.body.contains(panel)
          && accessUnsubs.length>0
        );
        if(listenersAlreadyActive) return;
        panel.innerHTML=`<div class="wbc-pro-head"><div><h3>Accès WB Carnet</h3><p>Chargement des accès…</p></div></div><div class="wbc-pro-body"><div class="wbc-pro-status">Connexion à WB Carnet…</div></div>`;
        if(!auth.currentUser){drawLinkedPanel(vehicle,panel,[],[]);return;}
        await startAccessListeners(vehicle,panel);
      }finally{renderingPanel=false;}
    });
  }

  const main=document.getElementById('main');
  if(main){ new MutationObserver(()=>renderPanel()).observe(main,{childList:true,subtree:false}); }
  auth.onAuthStateChanged(()=>{closeAccessListeners(); if(window.ATELIER_SPACE_ID) renderPanel();});
  window.addEventListener('online',scheduleSyncAll);
  window.atelierReady.then(()=>renderPanel()).catch(error=>console.error('WB Carnet Pro',error));
  console.info(`WB Carnet Pro v${VERSION} chargé.`);
})();
