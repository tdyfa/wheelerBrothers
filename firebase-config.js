/* ============================================================
   CONFIGURATION FIREBASE DU PROJET WHEELERBROTHERS — VERSION 49
   ============================================================
   - Authentification atelier par e-mail + mot de passe.
   - L'e-mail et l'UID ne sont pas secrets.
   - Le mot de passe n'est jamais enregistré dans les fichiers.
   - L'ancien code d'atelier est lu depuis Firestore après connexion.
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyChDwjw_9MkJJtHatts6u6FKyRMofR-YHs",
  authDomain: "wheelerbrothers.firebaseapp.com",
  projectId: "wheelerbrothers",
  storageBucket: "wheelerbrothers.firebasestorage.app",
  messagingSenderId: "440186092210",
  appId: "1:440186092210:web:212818cf3776eed30f27ab"
};

const ATELIER_LOGIN_EMAIL = "teddyfa0@outlook.fr";
const ATELIER_ADMIN_UID = "Hog6eKyPlAh3gkyJX7IstrLqADH3";

if(!firebase.apps.length){
  firebase.initializeApp(FIREBASE_CONFIG);
}

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage ? firebase.storage() : null;

auth.languageCode = 'fr';
db.enablePersistence({ synchronizeTabs: true }).catch(()=>{ /* déjà activé ou navigateur non supporté */ });

let atelierSpaceId = '';
let atelierReadyResolved = false;
let resolveAtelierReady;
const atelierReady = new Promise(resolve=>{ resolveAtelierReady = resolve; });
window.atelierReady = atelierReady;

/* Indicateur visuel commun aux outils : vert lorsque la session atelier
   et la configuration Firebase sont disponibles, rouge sinon. */
let atelierFirebaseConnected = false;

function refreshFirebaseStatusIndicators(){
  const connected = atelierFirebaseConnected === true;
  document.querySelectorAll('[data-firebase-status]').forEach(indicator=>{
    indicator.classList.toggle('is-connected', connected);
    indicator.classList.toggle('is-disconnected', !connected);
    indicator.setAttribute('aria-label', connected ? 'Firebase connecté' : 'Firebase déconnecté');
    indicator.setAttribute('title', connected ? 'Firebase connecté' : 'Firebase déconnecté');
  });
}

function setAtelierFirebaseStatus(connected){
  atelierFirebaseConnected = connected === true;
  window.ATELIER_FIREBASE_CONNECTED = atelierFirebaseConnected;
  refreshFirebaseStatusIndicators();
  window.dispatchEvent(new CustomEvent('atelier-firebase-status', {
    detail: { connected: atelierFirebaseConnected }
  }));
}
window.setAtelierFirebaseStatus = setAtelierFirebaseStatus;

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', refreshFirebaseStatusIndicators, {once:true});
}else{
  refreshFirebaseStatusIndicators();
}

window.addEventListener('offline', ()=>setAtelierFirebaseStatus(false));
window.addEventListener('online', ()=>{
  const user = auth.currentUser;
  setAtelierFirebaseStatus(Boolean(
    user &&
    user.uid === ATELIER_ADMIN_UID &&
    atelierSpaceId &&
    navigator.onLine
  ));
});

function whenDomReady(){
  if(document.readyState !== 'loading') return Promise.resolve();
  return new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
}

function authErrorMessage(error){
  const code = error?.code || '';
  if(code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Code atelier incorrect.';
  if(code.includes('too-many-requests')) return 'Trop de tentatives. Réessaie plus tard.';
  if(code.includes('network-request-failed')) return 'Connexion réseau indisponible.';
  if(code.includes('operation-not-allowed')) return "La connexion par e-mail et mot de passe n'est pas activée dans Firebase.";
  return error?.message || 'Connexion impossible.';
}

async function ensureAuthGate(){
  await whenDomReady();
  let gate = document.getElementById('atelierAuthGate');
  if(gate) return gate;
  gate = document.createElement('div');
  gate.id = 'atelierAuthGate';
  gate.innerHTML = `
    <style>
      #atelierAuthGate{position:fixed;inset:0;z-index:2147483647;background:#eef1f5;display:flex;align-items:center;justify-content:center;padding:24px;padding-top:max(24px,env(safe-area-inset-top));padding-bottom:max(24px,env(safe-area-inset-bottom));font-family:"Helvetica Neue",Arial,"Segoe UI",sans-serif;color:#111418}
      #atelierAuthGate[hidden]{display:none}
      #atelierAuthGate .auth-card{width:min(420px,100%);background:#fff;border:1px solid #e3e7ee;border-radius:20px;box-shadow:0 6px 24px rgba(16,24,40,.10);padding:30px 26px;text-align:center}
      #atelierAuthGate img{display:block;width:min(270px,82%);height:auto;margin:0 auto 24px}
      #atelierAuthGate h1{font-size:21px;margin:0 0 8px}
      #atelierAuthGate p{font-size:13px;line-height:1.45;color:#6b7280;margin:0 0 20px}
      #atelierAuthGate label{display:block;text-align:left;font-size:12px;font-weight:700;margin:0 0 7px}
      #atelierAuthGate input{width:100%;height:46px;border:1px solid #cfd5df;border-radius:11px;padding:0 13px;font:inherit;font-size:16px;outline:none}
      #atelierAuthGate input:focus{border-color:#111418;box-shadow:0 0 0 3px rgba(17,20,24,.08)}
      #atelierAuthGate button{width:100%;height:46px;border:0;border-radius:11px;background:#111418;color:#fff;font-weight:700;font-size:14px;cursor:pointer;margin-top:13px}
      #atelierAuthGate button:disabled{opacity:.55;cursor:default}
      #atelierAuthGate .auth-status{min-height:18px;margin-top:12px;font-size:12.5px;color:#6b7280}
      #atelierAuthGate .auth-status.error{color:#b42318}
      #atelierAuthGate .auth-version{margin-top:16px;font-size:11.5px;color:#6b7280;font-weight:600}
    </style>
    <section class="auth-card" role="dialog" aria-modal="true" aria-label="Connexion à l'atelier">
      <img src="report-cover-logo.png" alt="Wheeler Brothers">
      <h1>Accès à l’atelier</h1>
      <p>Saisis le nouveau code atelier. L’ancien code d’espace n’est plus demandé.</p>
      <form id="atelierAuthForm">
        <label for="atelierPassword">Code atelier</label>
        <input id="atelierPassword" type="password" autocomplete="current-password" required>
        <button id="atelierAuthButton" type="submit">Accéder à l’atelier</button>
        <div id="atelierAuthStatus" class="auth-status"></div>
      </form>
      <div class="auth-version">Version 49.9</div>
    </section>`;
  document.body.appendChild(gate);
  gate.querySelector('#atelierAuthForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const button = gate.querySelector('#atelierAuthButton');
    const status = gate.querySelector('#atelierAuthStatus');
    const password = gate.querySelector('#atelierPassword').value;
    status.className = 'auth-status';
    status.textContent = 'Connexion…';
    button.disabled = true;
    try{
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const credential = await auth.signInWithEmailAndPassword(ATELIER_LOGIN_EMAIL,password);
      if(credential.user.uid !== ATELIER_ADMIN_UID){
        await auth.signOut();
        throw new Error("Ce compte n'est pas autorisé.");
      }
      status.textContent = 'Ouverture de l’espace…';
    }catch(error){
      status.className = 'auth-status error';
      status.textContent = authErrorMessage(error);
      button.disabled = false;
    }
  });
  return gate;
}

async function showAuthGate(message=''){
  const gate = await ensureAuthGate();
  gate.hidden = false;
  const status = gate.querySelector('#atelierAuthStatus');
  const button = gate.querySelector('#atelierAuthButton');
  if(status){
    status.className = message ? 'auth-status error' : 'auth-status';
    status.textContent = message;
  }
  if(button) button.disabled = false;
  setTimeout(()=>gate.querySelector('#atelierPassword')?.focus(),50);
}

async function hideAuthGate(){
  const gate = await ensureAuthGate();
  gate.hidden = true;
}

async function loadAtelierConfiguration(user){
  if(!user || user.uid !== ATELIER_ADMIN_UID) throw new Error("Compte atelier non autorisé.");
  const snap = await db.collection('wbAtelierConfig').doc('main').get();
  if(!snap.exists) throw new Error("La configuration privée de l'atelier est introuvable.");
  const config = snap.data() || {};
  if(config.adminUid !== user.uid) throw new Error("L'UID administrateur ne correspond pas à la configuration.");
  if(typeof config.spaceId !== 'string' || config.spaceId.trim().length < 12) throw new Error("Le code d'espace enregistré dans Firebase est invalide.");
  atelierSpaceId = config.spaceId.trim();
  window.ATELIER_SPACE_ID = atelierSpaceId;
  setAtelierFirebaseStatus(navigator.onLine);
  await hideAuthGate();
  if(!atelierReadyResolved){
    atelierReadyResolved = true;
    resolveAtelierReady({user,spaceId:atelierSpaceId});
  }
}

auth.onAuthStateChanged(async user=>{
  if(!user){
    atelierSpaceId = '';
    setAtelierFirebaseStatus(false);
    await showAuthGate();
    return;
  }
  try{
    await loadAtelierConfiguration(user);
  }catch(error){
    atelierSpaceId = '';
    setAtelierFirebaseStatus(false);
    if(user.uid !== ATELIER_ADMIN_UID){
      try{ await auth.signOut(); }catch(_e){}
    }
    await showAuthGate(error.message);
  }
});

function getSharedCode(){
  return atelierSpaceId || null;
}

function ensureSharedCode(){
  if(!atelierSpaceId) throw new Error("L'atelier n'est pas encore authentifié.");
  return atelierSpaceId;
}

async function atelierSignOut(){
  await auth.signOut();
  location.reload();
}
window.atelierSignOut = atelierSignOut;
// Compatibilité avec les anciennes pages qui appelaient encore resetSharedCode().
window.resetSharedCode = atelierSignOut;

function sharedDocRef(toolName){
  return db.collection('spaces').doc(ensureSharedCode()).collection('tools').doc(toolName);
}

function sharedCollectionRef(name){
  return db.collection('spaces').doc(ensureSharedCode()).collection(name);
}

function dataUrlToBlob(dataUrl){
  return fetch(dataUrl).then(r => r.blob());
}

async function uploadImageDataUrl(dataUrl,pathHint){
  if(!storage) throw new Error('Firebase Storage non disponible');
  const code = ensureSharedCode();
  const blob = await dataUrlToBlob(dataUrl);
  const path = `spaces/${code}/${pathHint}`;
  const ref = storage.ref().child(path);
  await ref.put(blob,{contentType:blob.type || 'image/jpeg'});
  return await ref.getDownloadURL();
}

async function deleteStorageFolder(pathHint){
  if(!storage) return;
  try{
    const code = ensureSharedCode();
    const ref = storage.ref().child(`spaces/${code}/${pathHint}`);
    const list = await ref.listAll();
    await Promise.all(list.items.map(item=>item.delete().catch(()=>{})));
  }catch(e){ console.warn('Nettoyage Storage impossible',e); }
}

function deleteStorageFileByUrl(url){
  if(!storage || typeof url !== 'string' || !url.startsWith('https://')) return;
  try{ storage.refFromURL(url).delete().catch(()=>{}); }catch(_e){}
}
