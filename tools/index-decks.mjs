import {readdir,readFile,writeFile,mkdir,copyFile,rename,stat,lstat,mkdtemp,rm} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const hash=b=>createHash('sha256').update(b).digest('hex');
const pdfScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'pdf-card.py');
function pdfCommand(args){const r=spawnSync('python',[pdfScript,...args],{encoding:'utf8',timeout:60000});if(r.status!==0)throw Error((r.stderr||r.error?.message||'PDF renderer failed').trim());}
const readJson=async file=>JSON.parse(await readFile(file,'utf8'));
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const validMasterId=new RegExp(`^(r1|deck-${uuid})$`);
export async function indexDecks(root,{onProgress=()=>{}}={}){
  root=path.resolve(root);const parent=path.join(root,'All Decks');
  await mkdir(path.join(root,'data'),{recursive:true});
  if((await lstat(parent)).isSymbolicLink())throw Error('All Decks must be a real directory, not a symbolic link.');
  const manifests=[];const issues=[],decks=[],cards=[],assets=[],sources=[],identities=new Set();
  const previous=await readJson(path.join(root,'data/cards.json')).catch(e=>{if(e.code==='ENOENT')return {cards:[]};throw e;});
  const r1=await readJson(path.join(root,'data/r1-inventory.json')).catch(()=>null);
  const folders=await readdir(parent,{withFileTypes:true});
  for(const folder of folders.sort((a,b)=>a.name.localeCompare(b.name))){
    if(!folder.isDirectory()||folder.isSymbolicLink()){issues.push(`Unsupported entry in All Decks: ${folder.name}. Only real deck folders are supported.`);continue;}
    const directory=path.join(parent,folder.name),manifestPath=path.join(directory,'deck.json');let manifest;
    try{
      const entry=await lstat(manifestPath).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
      if(entry?.isSymbolicLink())throw Error('deck.json must be a real file inside its deck folder.');
      manifest=await readJson(manifestPath).catch(async e=>{if(e.code!=='ENOENT')throw e;const value={schemaVersion:1,id:`deck-${randomUUID()}`,title:folder.name};manifests.push({manifestPath,value});return value;});
      if(manifest.schemaVersion!==1||!validMasterId.test(manifest.id)||typeof manifest.title!=='string'||!manifest.title.trim()||manifest.title.length>160)throw Error('Invalid deck.json: expected schemaVersion 1, permanent ID r1/deck-UUID and a nonempty title (max 160).');
      if(identities.has(manifest.id))throw Error(`Duplicate deck identity ${manifest.id}. Each deck folder must have a unique permanent ID.`);
      identities.add(manifest.id);
    }catch(e){issues.push(`${folder.name}: ${e.message}`);continue;}
    decks.push({id:manifest.id,title:manifest.title});const groups=new Map(),pdfs=[];
    const entries=await readdir(directory,{withFileTypes:true});

    for(const file of entries){
      if(file.name==='deck.json')continue;
      const legacyPdf=/^([fb])(\d+)\.pdf$/i.exec(file.name);
      const hasPartner=legacyPdf&&entries.some(f=>new RegExp(`^${legacyPdf[1].toLowerCase()==='f'?'b':'f'}0*${Number(legacyPdf[2])}\\.(jpe?g|png|webp|gif|bmp|avif|pdf|tiff?)$`,'i').test(f.name));
      if(file.isFile()&&!file.isSymbolicLink()&&/\.pdf$/i.test(file.name)&&!hasPartner){pdfs.push(file.name);continue;}
      const match=/^([fb])(\d+)\.(jpe?g|png|webp|gif|bmp|avif|pdf|tiff?)$/i.exec(file.name);
      if(!file.isFile()||file.isSymbolicLink()||!match||!Number.isSafeInteger(Number(match[2]))){issues.push(`${folder.name}/${file.name}: unsupported asset or filename. Use F<number>/B<number> images or a two-page PDF.`);continue;}
      const number=Number(match[2]);if(!groups.has(number))groups.set(number,{f:[],b:[]});groups.get(number)[match[1].toLowerCase()].push({name:file.name,ext:match[3].toLowerCase()});
    }
    if(!groups.size&&!pdfs.length)issues.push(`${folder.name}: no physical card pairs or PDFs found.`);
    const seenPdf=new Set();
    for(const name of pdfs.sort()){
      onProgress({phase:'processing',message:`Processing PDF cards: ${folder.name}/${name}`});
      try{
        const sourcePath=path.join(directory,name);
        if((await stat(sourcePath)).size>30*1024*1024)throw Error('PDF exceeds the 30 MB per-file limit.');
        const sha256=hash(await readFile(sourcePath));
        if(seenPdf.has(sha256))throw Error('Duplicate PDF content in this deck. Keep one source per card.');
        seenPdf.add(sha256);pdfCommand([sourcePath]);
        const old=previous.cards.filter(c=>c.deckId===manifest.id&&c.sourceType==='pdf');
        const byName=old.find(c=>c.sourceFiles?.[0]===name),byHash=old.filter(c=>c.sourceHash===sha256);
        if(byHash.length>1)throw Error('Ambiguous PDF identity; multiple previous cards match the source.');
        if(byName&&byHash[0]&&byName.id!==byHash[0].id)throw Error('PDF filename/content identity conflict. Restore the original names before indexing.');
        const id=(byName||byHash[0])?.id||`${manifest.id}-pdf-${sha256}`;
        const prefix=`assets/cards/${manifest.id}/${id.slice(manifest.id.length+1)}`;
        const card={id,kind:'physical',deckId:manifest.id,title:name.replace(/\.pdf$/i,''),collection:manifest.title,sourceType:'pdf',sourceHash:sha256,sourceFiles:[name],front:prefix+'-1.png',back:prefix+'-2.png'};
        cards.push(card);
        const reuse=(byName||byHash[0])?.sourceHash===sha256&&await Promise.all([card.front,card.back].map(f=>readFile(path.join(root,f)).then(()=>true).catch(()=>false))).then(v=>v.every(Boolean));
        assets.push({sourcePath,target:path.join(root,prefix+'-1.png'),pdfPrefix:path.join(root,prefix),reuse});
        sources.push({deckId:manifest.id,file:name,sha256,assets:[card.front,card.back]});
      }catch(e){issues.push(`${folder.name}/${name}: ${e.message}`);}
    }
    for(const [number,pair] of [...groups.entries()].sort((a,b)=>a[0]-b[0])){
      if(pair.f.length!==1||pair.b.length!==1){issues.push(`${folder.name}: card ${number} has ${pair.f.length} front(s), ${pair.b.length} back(s). Missing partners or numeric naming conflict: ${[...pair.f,...pair.b].map(f=>f.name).join(', ')}`);continue;}
      const card={id:`${manifest.id}-${String(number).padStart(3,'0')}`,kind:'physical',title:manifest.id==='r1'?`R1 · Card ${String(number).padStart(2,'0')}`:`${manifest.title} · Card ${number}`,collection:manifest.title,deckId:manifest.id,sourceFiles:[pair.f[0].name,pair.b[0].name]};
      for(const side of ['f','b']){
        const source=pair[side][0],sourcePath=path.join(directory,source.name),sha256=hash(await readFile(sourcePath));
        const convert=['pdf','tif','tiff'].includes(source.ext),extension=convert?'png':source.ext;
        const asset=`assets/cards/${manifest.id}/${side}${number}.${extension}`;
        const known=r1?.inventory.find(item=>item.file===source.name);
        const reuse=convert&&manifest.id==='r1'&&known?.sha256===sha256&&await readFile(path.join(root,asset)).then(()=>true).catch(()=>false);
        assets.push({sourcePath,target:path.join(root,asset),convert,reuse});
        sources.push({deckId:manifest.id,file:source.name,sha256,asset});card[side==='f'?'front':'back']=asset;
      }
      cards.push(card);
    }
  }
  const ids=new Set(cards.map(c=>c.id));if(ids.size!==cards.length)issues.push('Duplicate card identities in catalog.');
  for(const card of previous.cards)if(!ids.has(card.id))issues.push(`Previously indexed card is missing: ${card.id}. Catalog update blocked to preserve identities; restore its folder/manifest/pair.`);
  const report={schemaVersion:1,decks:decks.length,cards:cards.length,issues,sources};
  const reportPath=path.join(root,'data/deck-index-report.json');
  await writeFile(reportPath,JSON.stringify(report,null,2));
  if(issues.length)throw Error(`Deck index blocked; previous catalog retained.\n${issues.join('\n')}`);
  await mkdir(path.join(root,'tmp'),{recursive:true});
  const staging=await mkdtemp(path.join(root,'tmp','deck-scan-')),published=[];
  try{
  for(const [index,planned] of assets.entries()){
    if(planned.reuse)continue;
    const asset={...planned,target:path.join(staging,`${index}${path.extname(planned.target)}`),pdfPrefix:planned.pdfPrefix?path.join(staging,`pdf-${index}`):undefined};
    onProgress({phase:'rendering',message:asset.pdfPrefix?'Processing PDF cards...':'Preparing card images...'});
    if(asset.reuse)continue;
    if(asset.pdfPrefix){try{pdfCommand([asset.sourcePath,asset.pdfPrefix]);}catch(e){report.issues.push(`${asset.sourcePath}: ${e.message}`);await writeFile(reportPath,JSON.stringify(report,null,2));throw e;}}
    else if(asset.convert){const result=spawnSync('python',[path.join(path.dirname(fileURLToPath(import.meta.url)),'render_asset.py'),asset.sourcePath,asset.target],{encoding:'utf8'});if(result.status!==0){report.issues.push(`Asset conversion failed: ${asset.sourcePath}: ${result.stderr||result.error?.message}`);await writeFile(reportPath,JSON.stringify(report,null,2));throw Error(report.issues.at(-1));}}
    else await copyFile(asset.sourcePath,asset.target);
    if(asset.pdfPrefix){for(const n of [1,2])published.push([`${asset.pdfPrefix}-${n}.png`,`${planned.pdfPrefix}-${n}.png`]);}
    else published.push([asset.target,planned.target]);
  }
  for(const [from,to] of published){await mkdir(path.dirname(to),{recursive:true});await copyFile(from,to);}
  for(const {manifestPath,value} of manifests)await writeFile(manifestPath,JSON.stringify(value,null,2),{flag:'wx'});
  const temp=path.join(root,'data/cards.next.json');await writeFile(temp,JSON.stringify({schemaVersion:1,version:'decks-v1',decks,cards},null,2));await rename(temp,path.join(root,'data/cards.json'));
  return report;
  }finally{await rm(staging,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=await indexDecks(process.cwd());console.log(`Indexed ${report.decks} deck(s), ${report.cards} cards; no pairing issues. Source files preserved.`);}
