import {mkdir,readdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.cwd(),parent=path.join(root,'All Decks'),target=path.join(parent,'Vortex Cards R1');
await mkdir(parent,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const inventory=JSON.parse(await readFile(path.join(root,'data/r1-inventory.json'),'utf8'));
for(const item of inventory.inventory){
  const original=await readFile(path.join(root,'Vortex Cards-R1',item.file));
  if(hash(original)!==item.sha256)throw Error(`Original checksum mismatch: ${item.file}`);
}
const folders=await readdir(parent,{withFileTypes:true});
for(const folder of folders.filter(f=>f.isDirectory())){
  const manifest=await readFile(path.join(parent,folder.name,'deck.json'),'utf8').then(JSON.parse).catch(()=>null);
  if(manifest?.id==='r1'){console.log(`R1 is already registered in ${folder.name}; no source changes made.`);process.exit(0);}
}
await mkdir(target,{recursive:true});
for(const item of inventory.inventory){
  const destination=path.join(target,item.file);
  const existing=await readFile(destination).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(existing&&hash(existing)!==item.sha256)throw Error(`Copy destination differs: ${item.file}; nothing will be overwritten.`);
  if(!existing)await copyFile(path.join(root,'Vortex Cards-R1',item.file),destination);
  if(hash(await readFile(destination))!==item.sha256)throw Error(`Copy verification failed: ${item.file}`);
}
await writeFile(path.join(target,'deck.json'),JSON.stringify({schemaVersion:1,id:'r1',title:'Vortex Cards R1'},null,2),{flag:'wx'});
console.log('Verified non-destructive R1 copy: 116 source files, permanent deck ID r1. Originals unchanged.');
