import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createVortexServer} from './serve.mjs';

// Isolated localhost server and disposable browser contexts; no real profile changes.
const catalog=JSON.parse(await readFile('data/cards.json','utf8'));
assert(catalog.decks.length>=5);assert(catalog.cards.length>=297);
assert.equal(new Set(catalog.cards.map(c=>c.id)).size,catalog.cards.length);
const server=createVortexServer({staticOnly:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try{
  for(const device of [{viewport:{width:1280,height:800}},devices['Pixel 7']]){
    const context=await browser.newContext({...device,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/?card=r1-001&side=back');
    await page.waitForFunction(count=>document.querySelector('#count-all').textContent===String(count),catalog.cards.length);
    assert.equal(await page.title(),'Good JuJu');
    assert.equal(await page.locator('#side-label').textContent(),'BACK');
    await page.locator('#card-face img').evaluate(img=>img.decode());
    assert(await page.locator('#card-face img').getAttribute('src').then(s=>s.includes('/r1/')));
    assert.equal(await page.locator('link[rel=manifest]').getAttribute('href'),'./manifest.webmanifest');
    assert.equal(await page.locator('.draw-controls button').count(),4);
    const boxes=await Promise.all(['#deck-select','#kind'].map(s=>page.locator(s).boundingBox()));
    assert(Math.abs(boxes[0].y-boxes[1].y)<10,'same-row filters');
    await page.locator('#favorite').click();
    await page.locator('[data-section=decks]').click();
    await page.locator('#custom-toggle').click();await page.locator('#custom-none').click();
    const ids=catalog.decks.slice(0,2).map(d=>d.id);
    for(const id of ids)await page.locator(`[data-pick="${id}"]`).click();
    assert.match(await page.locator('#custom-count').textContent(),/2/);
    assert.equal(await page.locator('.deck-pill').first().evaluate(el=>getComputedStyle(el).borderRadius),'50%');
    for(let i=0;i<3;i++){
      await page.locator('#shuffle').click();
      const src=await page.locator('#card-face img').getAttribute('src');
      assert(catalog.cards.some(c=>ids.includes(c.deckId)&&c.front===src));
    }
    await page.reload();await page.waitForFunction(count=>document.querySelector('#count-all').textContent===String(count),catalog.cards.length);
    assert.match(await page.evaluate(()=>localStorage.getItem('vortex-custom-decks')),new RegExp(ids[0]));
    assert.equal(await page.locator('#count-favorites').textContent(),'1');
    await page.locator('#deck-select').selectOption('__custom');await page.locator('#enlarge').click();
    assert(await page.locator('#expanded-dialog').evaluate(el=>el.open));
    assert.equal(await page.locator('#expanded-deck-select').inputValue(),'__custom');
    await page.locator('#expanded-flip').click();await page.waitForFunction(()=>document.querySelector('#expanded-flip').textContent==='Show front');
    await page.locator('#expanded-shuffle').click();
    await page.waitForFunction(()=>!document.querySelector('#expanded-shuffle').disabled);
    const expandedSrc=await page.locator('#expanded-face img').getAttribute('src');
    assert(catalog.cards.some(c=>ids.includes(c.deckId)&&c.front===expandedSrc));
    await page.locator('#expanded-more').click();assert(await page.locator('#expanded-details').isVisible());
    await page.locator('#expanded-copy-link').click();
    assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/\?card=/);
    await page.locator('#expanded-settings').click();
    assert.equal(await page.locator('#reveal-effect').inputValue(),'random');
    assert.equal(await page.locator('#reveal-direction').inputValue(),'random');
    assert.equal(await page.locator('#reveal-duration').inputValue(),'3.5');
    await page.locator('#reveal-duration').fill('1.9');await page.locator('#apply-settings').click();
    await page.locator('#close-settings').click();await page.locator('#minimize').click();
    await page.waitForFunction(()=>!document.body.classList.contains('enlarged'));
    await page.reload();await page.waitForFunction(count=>document.querySelector('#count-all').textContent===String(count),catalog.cards.length);
    await page.locator('#settings-open').click();assert.equal(await page.locator('#reveal-duration').inputValue(),'1.9');
    await page.locator('#close-settings').click();
    const exported=await page.evaluate(async()=>{
      const s=await import('./app/share.js'),lib=await (await fetch('./data/cards.json')).json();
      const card=lib.cards.find(c=>c.id==='r1-001');let files;
      Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
      Object.defineProperty(navigator,'share',{configurable:true,value:async x=>{files=x.files?.map(f=>({name:f.name,type:f.type,size:f.size}));}});
      const multi=await s.shareCardAsImage(card);
      const multiFiles=files;
      Object.defineProperty(navigator,'canShare',{configurable:true,value:x=>x.files.length===1});
      const combined=await s.shareCardAsImage(card);
      const pdf=await s.sharePdfCard(lib.cards.find(c=>c.sourceType==='pdf'));
      const generated=await s.buildTwoPagePdfBlob({...card,sourceType:'pdf'});
      const personal=s.buildCardShareUrl({id:'user-private'},{baseHref:location.href,masterCards:lib.cards});
      return {multi,multiFiles,combined,pdf,generatedSize:generated.blob.size,personal};
    });
    assert.equal(exported.multi.method,'native-images');assert.equal(exported.multiFiles.length,2);
    assert.match(exported.multiFiles[0].name,/-front.png$/);assert.match(exported.multiFiles[1].name,/-back.png$/);
    assert.equal(exported.combined.method,'native-combined-image');
    assert.equal(exported.pdf.source,'original-pdf');assert(exported.generatedSize>1000);assert.equal(exported.personal,null);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
    assert.deepEqual(errors,[]);console.log(`Reader/share/custom-selection/persistence passed: ${device.viewport.width}px`);
    await context.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
