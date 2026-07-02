/* ============================================================
   CONFIGURATION FIREBASE — à remplir une seule fois
   ============================================================
   1. Va sur https://console.firebase.google.com
   2. Crée un projet gratuit (Spark plan), ajoute une "Web App".
   3. Copie ici les valeurs affichées dans "Config du SDK".
   4. Active Firestore Database (mode production), puis colle les
      règles de sécurité fournies dans LISEZ-MOI-iPhone.md.
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyChDwjw_9MkJJtHatts6u6FKyRMofR-YHs",
  authDomain: "wheelerbrothers.firebaseapp.com",
  projectId: "wheelerbrothers",
  storageBucket: "wheelerbrothers.firebasestorage.app",
  messagingSenderId: "440186092210",
  appId: "1:440186092210:web:212818cf3776eed30f27ab"
};

if(!firebase.apps.length){
  firebase.initializeApp(FIREBASE_CONFIG);
}
const db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(()=>{ /* déjà activé ou navigateur non supporté, on ignore */ });

/* ---- code d'atelier partagé (identifiant de l'espace commun) ---- */
function getSharedCode(){
  return localStorage.getItem('shared_code');
}

function ensureSharedCode(){
  let code = getSharedCode();
  if(code) return code;

  const suggestion = 'atelier-' + Math.random().toString(36).slice(2, 10);
  while(true){
    code = prompt(
      "Code d'atelier partagé\n\n" +
      "Entre le code déjà communiqué par ton binôme, ou valide celui proposé " +
      "ci-dessous pour créer un nouvel espace (tu devras le lui transmettre).\n\n" +
      "Le code doit faire au moins 12 caractères (c'est ta protection d'accès).",
      suggestion
    );
    if(code === null) code = suggestion; // annulé -> on prend la suggestion, déjà assez longue
    code = code.trim();
    if(code.length >= 12) break;
    alert(`Ce code ne fait que ${code.length} caractère(s), il en faut au moins 12. Réessaie, ou valide simplement la suggestion proposée.`);
  }
  localStorage.setItem('shared_code', code);
  return code;
}

function resetSharedCode(){
  if(!confirm("Changer de code d'atelier ? Il faudra ressaisir le code voulu (le tien ou celui de ton binôme).")){
    return;
  }
  localStorage.removeItem('shared_code');
  const newCode = ensureSharedCode();
  alert("Code enregistré (" + newCode + ").\nRouvre un outil pour te connecter à cet espace.");
}

function sharedDocRef(toolName){
  const code = ensureSharedCode();
  return db.collection('spaces').doc(code).collection('tools').doc(toolName);
}

function sharedCollectionRef(name){
  const code = ensureSharedCode();
  return db.collection('spaces').doc(code).collection(name);
}

/* ---- Firebase Storage : upload des photos volumineuses ---- */
const storage = firebase.storage ? firebase.storage() : null;

function dataUrlToBlob(dataUrl){
  return fetch(dataUrl).then(r => r.blob());
}

async function uploadImageDataUrl(dataUrl, pathHint){
  if(!storage) throw new Error('Firebase Storage non disponible');
  const code = ensureSharedCode();
  const blob = await dataUrlToBlob(dataUrl);
  const path = `spaces/${code}/${pathHint}`;
  const ref = storage.ref().child(path);
  await ref.put(blob, { contentType: blob.type || 'image/jpeg' });
  return await ref.getDownloadURL();
}

async function deleteStorageFolder(pathHint){
  if(!storage) return;
  try{
    const code = ensureSharedCode();
    const ref = storage.ref().child(`spaces/${code}/${pathHint}`);
    const list = await ref.listAll();
    await Promise.all(list.items.map(item => item.delete().catch(()=>{})));
  }catch(e){ console.warn('Nettoyage Storage impossible (dossier vide ou déjà supprimé)', e); }
}

function deleteStorageFileByUrl(url){
  if(!storage || typeof url !== 'string' || !url.startsWith('https://')) return;
  try{
    storage.refFromURL(url).delete().catch(()=>{});
  }catch(e){ /* URL non Storage ou déjà supprimée, on ignore */ }
}
