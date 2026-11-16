import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {createVortexServer} from './serve.mjs';
const remote=process.argv[2];let server;
if(!remote){server=createVortexServer({staticOnly:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
const base=remote||`http://127.0.0.1:${server.address().port}/`,browser=await chromium.launch();
try{
 for(const device of [{viewport:{width:1280,height:800}},devices['Pixel 7']]){
  const context=await browser.newContext({...device,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>document.querySelector('#count-all').textContent==='321');
  const collapse=async id=>{if(await page.locator(id).evaluate(el=>el.open))await page.locator(id+' summary').click();};
  const expand=async id=>{if(!await page.locator(id).evaluate(el=>el.open))await page.locator(id+' summary').click();};
  await page.goto(base);await ready();await page.locator('[data-section=decks]').click();
  assert.equal(await page.locator('#published-decks-count').textContent(),'7');
  assert.equal(await page.locator('#personal-decks-count').textContent(),'0');assert(await page.locator('#personal-decks-empty').isVisible());
  await collapse('#published-decks-group');await collapse('#personal-decks-group');
  assert(await page.locator('#create-deck-form').isVisible());
  await page.locator('#new-deck-name').fill('Quiet moments');await page.locator('#create-deck-form button').click();
  await page.waitForFunction(()=>document.querySelector('#personal-decks-count').textContent==='1');
  const id=await page.locator('#deck-select').inputValue();assert(id.startsWith('user-deck-'));
  // Seed a disposable browser profile to verify existing personal metadata is preserved.
  await page.evaluate(async id=>{
   const {mutatePersonal}=await import('./app/storage.js');
   await mutatePersonal(p=>({...p,cards:[{id:'user-group-check',deckId:id,kind:'digital',title:'Quiet',front:'A quiet moment',back:'Take one easy breath.',background:'#234938',color:'#fff8ed'}],overrides:{'r1-001':{favorite:true,tags:['Ease'],title:'Personal title'},'r1-002':{archived:true,tags:['Rest']}},settings:{...p.settings,noRepeat:true}}));
  },id);
  await page.reload();await ready();await page.locator('[data-section=decks]').click();await expand('#personal-decks-group');
  assert(!(await page.locator('#personal-decks-empty').isVisible()));
  await page.locator('#custom-toggle').click();await page.locator('#custom-none').click();
  assert.match(await page.locator('#custom-count').textContent(),/0\s*\/\s*8/);
  await page.locator('#custom-all').click();assert.match(await page.locator('#custom-count').textContent(),/8\s*\/\s*8/);
  await page.locator('#custom-none').click();await expand('#published-decks-group');
  for(const key of ['r1',id])await page.locator(`[data-pick="${key}"]`).click();
  assert.match(await page.locator('#custom-count').textContent(),/2\s*\/\s*8/);
  const pill=await page.locator(`[data-pick="${id}"]`).boundingBox();assert.equal(pill.width,24);assert.equal(pill.height,24);
  const count=await page.locator('#card-position').textContent();assert.match(count,/58 cards/);
  await collapse('#published-decks-group');await collapse('#personal-decks-group');
  assert.equal(await page.locator('#card-position').textContent(),count);
  await page.locator('#shuffle').click();await page.waitForFunction(()=>!document.querySelector('#shuffle').disabled);
  const valid=await page.locator('#card-face').evaluate(el=>!el.querySelector('img')||el.querySelector('img').getAttribute('src').includes('/r1/'));assert(valid);
  await page.locator('#enlarge').click();assert.equal(await page.locator('#expanded-deck-select').inputValue(),'__custom');
  await page.locator('#expanded-deck-select').selectOption(id);assert.equal(await page.locator('#deck-select').inputValue(),id);
  await page.locator('#expanded-flip').click();await page.waitForFunction(()=>document.querySelector('#expanded-flip').textContent==='Show front');
  await page.locator('#expanded-deck-select').selectOption('__custom');
  await page.locator('#minimize').click();await page.waitForFunction(()=>!document.body.classList.contains('enlarged'));
  await page.reload();await ready();await page.locator('#deck-select').selectOption('__custom');
  assert.equal(await page.locator('#card-position').textContent(),count);
  const stored=await page.evaluate(async()=>await(await import('./app/storage.js')).readPersonal());
  assert.equal(stored.cards[0].id,'user-group-check');assert.equal(stored.cards[0].deckId,id);
  assert.deepEqual(stored.overrides['r1-001'],{favorite:true,tags:['Ease'],title:'Personal title'});
  assert.deepEqual(stored.overrides['r1-002'],{archived:true,tags:['Rest']});assert.equal(stored.settings.noRepeat,true);
  const selection=await page.evaluate(()=>JSON.parse(localStorage.getItem('vortex-custom-decks')));assert(selection);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#theme-toggle').click();await page.locator('[data-section=decks]').click();
  assert.equal(await page.locator('#published-decks-count').textContent(),'7');assert.equal(await page.locator('#personal-decks-count').textContent(),'1');
  assert.deepEqual(errors,[]);console.log(`${base} ${device.viewport.width}px: groups,empty state,creation,mixed selection,collapse,persistence,metadata,reader sync passed.`);
  await context.close();
 }
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
