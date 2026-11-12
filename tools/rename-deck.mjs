import {readdir,readFile,writeFile,rename,access} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export async function renameDeck(root,id,title,folder){
  const parent=path.resolve(root,'All Decks');let found;
  for(const entry of await readdir(parent,{withFileTypes:true}))if(entry.isDirectory()&&!entry.isSymbolicLink()){
    const directory=path.join(parent,entry.name),manifest=await readFile(path.join(directory,'deck.json'),'utf8').then(JSON.parse).catch(()=>null);
    if(manifest?.id===id){if(found)throw Error('Duplicate permanent identity; repair the index first.');found={directory,manifest};}
  }
  if(!found)throw Error('Permanent deck ID not found.');
  if(!title?.trim()||title.length>160)throw Error('Supply a displayed title (1–160 characters).');
  const target=folder?path.resolve(parent,folder):found.directory;
  if(path.dirname(target)!==parent||/[<>:"|?*]/.test(folder||'')||(folder&&/[. ]$/.test(folder)))throw Error('Folder must be a single valid child name within All Decks.');
  if(target!==found.directory){if(await access(target).then(()=>true).catch(()=>false))throw Error('Destination already exists; no files overwritten.');await rename(found.directory,target);}
  await writeFile(path.join(target,'deck.json'),JSON.stringify({...found.manifest,title:title.trim()},null,2));
  return {id,title:title.trim(),folder:path.basename(target)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [id,title,folder]=process.argv.slice(2);console.log(await renameDeck(process.cwd(),id,title,folder));console.log('Permanent identity preserved. Run npm run index:decks (or npm run build). Original Vortex Cards-R1 is untouched.');}
