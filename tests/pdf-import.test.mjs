import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rename,copyFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {indexDecks} from '../tools/index-decks.mjs';
import {validateBackup,emptyPersonal} from '../app/library.js';
import {pdfFixture} from './pdf-fixture.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
test('mixed PDF deck: orientations, immutable sources, repeat indexing, safe renames, edits and failure retention',async()=>{
  await mkdir('tmp',{recursive:true});const root=await mkdtemp(path.resolve('tmp/pdf-index-')),deck=path.join(root,'All Decks/Mixed');await mkdir(deck,{recursive:true});
  const originals=new Map([['Card001.pdf',pdfFixture()],['Gratitude.PDF',pdfFixture(2,{variant:2})]]);
  for(const [name,bytes] of originals)await writeFile(path.join(deck,name),bytes);
  await copyFile('assets/cards/r1/f1.jpg',path.join(deck,'F1.jpg'));await copyFile('assets/cards/r1/b1.jpg',path.join(deck,'B1.jpg'));
  assert.equal((await indexDecks(root)).cards,3);
  const catalog=async()=>JSON.parse(await readFile(path.join(root,'data/cards.json'),'utf8'));
  const first=await catalog(),ids=first.cards.map(c=>c.id);assert.equal(new Set(ids).size,3);
  const pdf=first.cards.find(c=>c.sourceFiles[0]==='Card001.pdf');assert.match(pdf.id,/-pdf-/);
  for(const [side,width,height] of [['front',360,560],['back',560,360]]){const png=await readFile(path.join(root,pdf[side]));assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);}
  for(const [name,bytes] of originals)assert.equal(digest(await readFile(path.join(deck,name))),digest(bytes));
  await indexDecks(root);assert.deepEqual((await catalog()).cards.map(c=>c.id),ids);
  await rename(path.join(deck,'Card001.pdf'),path.join(deck,'Allowing.pdf'));await indexDecks(root);assert.equal((await catalog()).cards.find(c=>c.sourceFiles[0]==='Allowing.pdf').id,pdf.id);
  await writeFile(path.join(deck,'Allowing.pdf'),pdfFixture(2,{variant:9}));await indexDecks(root);assert.equal((await catalog()).cards.find(c=>c.sourceFiles[0]==='Allowing.pdf').id,pdf.id);
  const stable=await readFile(path.join(root,'data/cards.json'),'utf8');
  for(const [name,bytes,message] of [['One.pdf',pdfFixture(1),/found 1/],['Three.pdf',pdfFixture(3),/found 3/],['Bad.pdf',Buffer.from('broken PDF'),/Bad.pdf/],['Locked.pdf',pdfFixture(2,{encrypted:true}),/Encrypted/],['Blank-password.pdf',pdfFixture(2,{encrypted:true,blankPassword:true}),/Encrypted/],['Copy.pdf',originals.get('Gratitude.PDF'),/Duplicate PDF/]]){
    await writeFile(path.join(deck,name),bytes);await assert.rejects(()=>indexDecks(root),message);assert.equal(await readFile(path.join(root,'data/cards.json'),'utf8'),stable);await unlink(path.join(deck,name));
  }
  await writeFile(path.join(deck,'F9.pdf'),pdfFixture());await copyFile('assets/cards/r1/b1.jpg',path.join(deck,'B9.jpg'));
  await assert.rejects(()=>indexDecks(root),/legacy F\/B face/);assert.equal(await readFile(path.join(root,'data/cards.json'),'utf8'),stable);await unlink(path.join(deck,'F9.pdf'));await unlink(path.join(deck,'B9.jpg'));
  await unlink(path.join(deck,'Allowing.pdf'));await assert.rejects(()=>indexDecks(root),/Previously indexed card is missing/);assert.equal(await readFile(path.join(root,'data/cards.json'),'utf8'),stable);
  const personal=emptyPersonal();personal.overrides[pdf.id]={favorite:true,deckId:pdf.deckId};assert.deepEqual(validateBackup({format:'into-the-vortex',version:1,personal}),personal);
});
test('PDF-only discovery supports numbered names without colliding with a numbered image card',async()=>{
  await mkdir('tmp',{recursive:true});const root=await mkdtemp(path.resolve('tmp/pdf-only-')),deck=path.join(root,'All Decks/New Deck');await mkdir(deck,{recursive:true});
  await writeFile(path.join(deck,'1.pdf'),pdfFixture());await writeFile(path.join(deck,'2.pdf'),pdfFixture(2,{variant:2}));
  assert.equal((await indexDecks(root)).cards,2);
  await copyFile('assets/cards/r1/f1.jpg',path.join(deck,'F1.jpg'));await copyFile('assets/cards/r1/b1.jpg',path.join(deck,'B1.jpg'));
  assert.equal((await indexDecks(root)).cards,3);
  const before=await readFile(path.join(root,'data/cards.json'),'utf8');await writeFile(path.join(deck,'F1.pdf'),pdfFixture());await assert.rejects(()=>indexDecks(root),/naming conflict/);assert.equal(await readFile(path.join(root,'data/cards.json'),'utf8'),before);
});
