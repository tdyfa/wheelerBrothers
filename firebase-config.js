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
  apiKey: "AIzaSyChDwjw_9MkJJtHatts6u6FKyRMofR",
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
  if(!code){
    const suggestion = 'atelier-' + Math.random().toString(36).slice(2, 10);
    code = prompt(
      "Code d'atelier partagé\n\n" +
      "Entre le code déjà communiqué par ton binôme, ou valide celui proposé " +
      "ci-dessous pour créer un nouvel espace (tu devras le lui transmettre) :",
      suggestion
    );
    if(!code) code = suggestion;
    code = code.trim();
    localStorage.setItem('shared_code', code);
  }
  return code;
}

function sharedDocRef(toolName){
  const code = ensureSharedCode();
  return db.collection('spaces').doc(code).collection('tools').doc(toolName);
}
