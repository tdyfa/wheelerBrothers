/* Transferts IA Storage : reprises bornées, sans compression ni écrasement ambigu. */
(function(global){
  'use strict';
  const LIMIT=3, CHUNK=512*1024;
  const hashes=new WeakMap();
  function httpStatus(error){
    for(const x of [error?.httpStatus,error?.statusCode,error?.status]){
      const n=Number(x);if(Number.isInteger(n)&&n>=100&&n<=599)return n;
    }
    // Ne jamais afficher la réponse brute : elle peut contenir un jeton.
    if(typeof error?.serverResponse==='string'&&error.serverResponse.length<=65536)try{
      const v=JSON.parse(error.serverResponse),n=Number(v?.error?.code??v?.code??v?.status);
      if(Number.isInteger(n)&&n>=100&&n<=599)return n;
    }catch(_){}
    return null;
  }
  function safeCode(error){const c=String(error?.code||'');return /^storage\/[a-z0-9-]+$/.test(c)?c:'storage/unknown';}
  // Les SDK Web n'exposent pas toujours le corps HTTP. Si une réponse JSON est
  // disponible, ne retenir qu'un code symbolique connu, jamais son message.
  function safeServerReason(error){
    const raw=error?.serverResponse;
    if(typeof raw!=='string'||raw.length>65536)return null;
    try{
      const parsed=JSON.parse(raw),value=parsed?.error?.status;
      return ['INVALID_ARGUMENT','FAILED_PRECONDITION','OUT_OF_RANGE','PERMISSION_DENIED','UNAUTHENTICATED','RESOURCE_EXHAUSTED'].includes(value)?value:null;
    }catch(_){return null;}
  }
  function retryable(error){
    const code=safeCode(error);
    if(['storage/unauthorized','storage/unauthenticated','storage/canceled','storage/object-not-found','storage/invalid-checksum','storage/quota-exceeded'].includes(code))return false;
    const n=httpStatus(error);if(n!==null)return n===408||n===429||n>=500;
    return ['storage/unknown','storage/retry-limit-exceeded','storage/network-request-failed','storage/network-error'].includes(code);
  }
  function safeError(error,context){
    const code=safeCode(error),http=httpStatus(error),reason=safeServerReason(error);
    const e=new Error(context+' ('+code+(http?' · HTTP '+http:'')+(reason?' · '+reason:'')+'). Aucun contenu de réponse serveur n’est affiché.');
    e.code=code;if(http)e.httpStatus=http;return e;
  }
  function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  async function retryRead(action,context,onRetry){
    for(let i=0;i<LIMIT;i++)try{return await action();}catch(e){
      if(safeCode(e)==='storage/object-not-found')throw e;
      if(!retryable(e)||i===LIMIT-1)throw safeError(e,context);
      onRetry?.(i+1,LIMIT-1);await wait(700*2**i+Math.floor(Math.random()*300));
    }
  }
  async function bufferOf(blob){
    if(typeof blob.arrayBuffer==='function')return blob.arrayBuffer();
    return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Lecture locale du fichier impossible.'));r.readAsArrayBuffer(blob);});
  }
  async function hash(blob){
    if(!global.md5?.create)throw new Error('Vérification locale indisponible : recharge la page avant toute reprise.');
    if(hashes.has(blob))return hashes.get(blob);
    const promise=(async()=>{const h=global.md5.create();for(let i=0;i<blob.size;i+=CHUNK)h.update(await bufferOf(blob.slice(i,Math.min(blob.size,i+CHUNK))));return h.base64();})();
    hashes.set(blob,promise);try{return await promise;}catch(e){hashes.delete(blob);throw e;}
  }
  async function existsAndMatches(ref,blob,onRetry){
    let meta;
    try{meta=await retryRead(()=>ref.getMetadata(),'Impossible de vérifier le fichier Storage',onRetry);}
    catch(e){if(safeCode(e)==='storage/object-not-found')return false;throw e;}
    if(Number(meta?.size)!==blob.size)throw new Error('Un fichier différent existe déjà à cet emplacement : transfert arrêté pour préserver les données.');
    if(typeof meta?.md5Hash!=='string'||!meta.md5Hash)throw new Error('Empreinte Storage indisponible : reprise arrêtée pour éviter un écrasement incertain.');
    if(await hash(blob)!==meta.md5Hash)throw new Error('Le fichier sélectionné diffère de celui déjà transféré : reprise arrêtée sans écrasement.');
    return true;
  }
  async function put(ref,blob,metadata,{reconcileFirst=false,onProgress,onRetry}={}){
    if(reconcileFirst&&await existsAndMatches(ref,blob,onRetry))return {reused:true};
    for(let i=0;i<LIMIT;i++){
      try{
        const task=ref.put(blob,metadata);task.on('state_changed',onProgress||(()=>{}));await task;
        return {reused:false};
      }catch(e){
        // storage/unknown + HTTP 400 est ambigu. Le client a constaté que les
        // mêmes photos peuvent réussir à un autre essai : au plus UNE nouvelle
        // session, sans écraser un objet existant. Un motif serveur explicite
        // de validation est permanent tant qu'il n'est pas compris.
        const ambiguous400=safeCode(e)==='storage/unknown'&&httpStatus(e)===400&&!safeServerReason(e);
        if(!retryable(e)&&!ambiguous400)throw safeError(e,'Transfert Storage interrompu');
        // Après un résultat incertain, ne renvoyer que si Storage confirme 404.
        if(await existsAndMatches(ref,blob,onRetry))return {reused:true};
        if(i===LIMIT-1||(ambiguous400&&i>=1))throw safeError(e,'Transfert Storage interrompu après vérification');
        onRetry?.(i+1,LIMIT-1);await wait(700*2**i+Math.floor(Math.random()*300));
      }
    }
  }
  async function url(ref,onRetry){try{return await retryRead(()=>ref.getDownloadURL(),'Impossible de récupérer le lien de la photo',onRetry);}catch(e){throw safeError(e,'Impossible de récupérer le lien de la photo');}}
  global.WBAITransfer={put,url,existsAndMatches,httpStatus,retryable,safeError,safeServerReason,hash};
})(typeof window!=='undefined'?window:globalThis);
