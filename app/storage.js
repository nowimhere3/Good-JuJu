import {emptyPersonal} from './library.js';
let db;
export async function openStorage(){
  db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open('into-the-vortex',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('personal');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(Error('Close other VORTEX tabs and reload to update storage.'));
  });
  db.onversionchange=()=>db.close();
  return readPersonal();
}
export async function readPersonal(){
  return new Promise((resolve,reject)=>{const req=db.transaction('personal').objectStore('personal').get('library');req.onsuccess=()=>resolve(req.result||emptyPersonal());req.onerror=()=>reject(req.error);});
}
export async function mutatePersonal(update){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('personal','readwrite');const store=tx.objectStore('personal');const req=store.get('library');let next;
    req.onsuccess=()=>{try{next=update(req.result||emptyPersonal());store.put(next,'library');}catch(e){tx.abort();reject(e);}};
    tx.oncomplete=()=>resolve(next);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage change was canceled.'));
  });
}
