import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {createVortexServer} from './serve.mjs';

// Pass the Pages URL to repeat this check on the published collection.
const remote=process.argv[2];let server;
if(!remote){server=createVortexServer({staticOnly:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
const base=remote||`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch();
try{
 for(const device of [{viewport:{width:1280,height:800}},devices['Pixel 7']]){
  const context=await browser.newContext({...device,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#count-all').textContent==='321');
  const catalog=await page.evaluate(async()=>await(await fetch('./data/cards.json',{cache:'reload'})).json());
  assert.equal(catalog.decks.length,7);assert.equal(catalog.cards.length,321);assert.equal(new Set(catalog.cards.map(c=>c.id)).size,321);
  const added=catalog.decks.filter(d=>['Joe D','Regular - Genreral - Deck'].includes(d.title));assert.equal(added.length,2);
  const cards=catalog.cards.filter(c=>added.some(d=>d.id===c.deckId));assert.equal(cards.length,24);
  const decoded=await page.evaluate(async cards=>{
   let count=0;for(const card of cards)for(const side of ['front','back']){const img=new Image();img.src=card[side];await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw Error(card.id+' '+side);count++;}return count;
  },cards);assert.equal(decoded,48);
  for(const deck of added){
   await page.locator('#deck-select').selectOption(deck.id);
   assert.match(await page.locator('#selection-label').textContent(),new RegExp(deck.title));
   for(let i=0;i<3;i++){
    await page.locator('#shuffle').click();await page.waitForFunction(()=>!document.querySelector('#shuffle').disabled);
    const src=await page.locator('#card-face img').getAttribute('src');assert(cards.some(c=>c.deckId===deck.id&&c.front===src));
   }
   const front=await page.locator('#card-face img').getAttribute('src'),card=cards.find(c=>c.front===front);
   await page.locator('#flip').click();await page.waitForFunction(()=>document.querySelector('#side-label').textContent==='BACK');
   assert.equal(await page.locator('#card-face img').getAttribute('src'),card.back);
   await page.locator('#enlarge').click();await page.locator('#expanded-face img').evaluate(img=>img.decode());
   assert.equal(await page.locator('#expanded-face img').getAttribute('src'),card.back);
   await page.locator('#minimize').click();await page.waitForFunction(()=>!document.body.classList.contains('enlarged'));
  }
  await page.locator('#reset').click();await page.locator('[data-section=decks]').click();
  await page.locator('#custom-toggle').click();await page.locator('#custom-none').click();
  for(const d of added)await page.locator(`[data-pick="${d.id}"]`).click();
  await page.locator('#shuffle').click();await page.waitForFunction(()=>!document.querySelector('#shuffle').disabled);
  assert(cards.some(c=>c.front===undefined)===false);
  const chosen=await page.locator('#card-face img').getAttribute('src');assert(cards.some(c=>c.front===chosen));
  await page.reload();await page.waitForFunction(()=>document.querySelector('#count-all').textContent==='321');
  const saved=await page.evaluate(()=>localStorage.getItem('vortex-custom-decks'));for(const d of added)assert(saved.includes(d.id));
  assert.deepEqual(errors,[]);console.log(`${base} ${device.viewport.width}px: 7 decks,321 cards,48 new faces decoded; selection,shuffle,flip,enlarged,custom persistence passed.`);
  await context.close();
 }
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
