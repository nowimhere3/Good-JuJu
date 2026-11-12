import {readFile} from 'node:fs/promises';
import {indexDecks} from './index-decks.mjs';
try{
  const before=await readFile('data/cards.json','utf8').then(JSON.parse).catch(()=>({cards:[],decks:[]}));
  const report=await indexDecks(process.cwd(),{onProgress:p=>process.send?.({type:'progress',...p})});
  const after=JSON.parse(await readFile('data/cards.json','utf8'));
  const oldCards=new Set(before.cards.map(c=>c.id)),oldDecks=new Set((before.decks||[]).map(d=>d.id));
  process.send?.({type:'complete',decks:report.decks,cards:report.cards,newDecks:after.decks.filter(d=>!oldDecks.has(d.id)).length,newCards:after.cards.filter(c=>!oldCards.has(c.id)).length,issues:report.issues});
}catch(e){process.send?.({type:'error',message:e.message});process.exitCode=1;}
process.disconnect?.();
