import {test,expect} from '@playwright/test';
test('real deck scan refreshes without draws or metadata loss, repeats without duplicates, and reads PDF faces',async({page},info)=>{
  test.setTimeout(240000);await page.goto('/');
  await expect(page.locator('#card')).toBeVisible();
  await page.locator('#favorite').click();
  await page.evaluate(async()=>{const {mutatePersonal}=await import('/app/storage.js');await mutatePersonal(p=>({...p,overrides:{...p.overrides,'r1-002':{title:'Keep edit',tags:['Keep tag'],archived:true}}}));});
  const personal=()=>page.evaluate(async()=>{const {readPersonal}=await import('/app/storage.js');return readPersonal();});const before=await personal();
  await page.locator('[data-section="decks"]').click();await page.locator('[data-deck="r1"]').click();
  const face=await page.locator('#card-face img').getAttribute('src');const status=page.locator('#scan-status');
  await expect(page.locator('#scan-decks')).toBeEnabled();await page.locator('#scan-decks').click();await expect(page.locator('#scan-decks')).toHaveAttribute('aria-busy','true');
  await expect(status).toContainText('Scan complete!',{timeout:210000});await expect(status).toContainText('2 decks found. 118 cards indexed.');
  expect(await personal()).toEqual(before);await expect(page.locator('#deck-select')).toHaveValue('r1');await expect(page.locator('#card-face img')).toHaveAttribute('src',face);
  await page.locator('#scan-decks').click();await expect(status).toContainText('0 new decks and 0 new cards',{timeout:90000});expect(await personal()).toEqual(before);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#scan-decks').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('scan-complete.png')});
  const catalog=await page.evaluate(()=>fetch('/data/cards.json').then(r=>r.json()));expect(new Set(catalog.cards.map(c=>c.id)).size).toBe(118);expect(catalog.cards.filter(c=>c.deckId==='r1')).toHaveLength(58);
  const deck=catalog.decks.find(d=>d.title==='Ask & It Is Given');const cards=catalog.cards.filter(c=>c.deckId===deck.id);expect(cards).toHaveLength(60);const pdfs=cards.filter(c=>c.sourceType==='pdf');expect(pdfs).toHaveLength(57);
  await page.evaluate(async cards=>{for(const c of cards)for(const side of ['front','back']){const im=new Image();im.src=c[side];await im.decode();if(!im.naturalWidth)throw Error('Missing PDF face');}},pdfs);
  await page.locator(`[data-deck="${deck.id}"]`).click();await expect(page.locator('#grid .mini-card')).toHaveCount(60);
  await page.locator('#shuffle').click();await expect(page.locator('#shuffle')).not.toHaveAttribute('aria-busy','true');expect(cards.some(c=>c.front===undefined)).toBe(false);
  await page.locator(`[data-card="${pdfs[0].id}"]`).click();await page.locator('#flip').click();await expect(page.locator('#card-face img')).toHaveAttribute('src',pdfs[0].back);
  await page.locator('#enlarge').click();await expect(page.locator('#expanded-face img')).toHaveAttribute('src',pdfs[0].back);await page.locator('#expanded-flip').click();await expect(page.locator('#expanded-face img')).toHaveAttribute('src',pdfs[0].front);await expect.poll(()=>page.locator('#expanded-face img').evaluate(im=>im.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('ask-deck-reader.png')});
});
test('static hosting explains unavailable scanning and scan failures are actionable',async({page})=>{
  await page.route('**/api/decks/capabilities',route=>route.fulfill({status:404,body:'Not found'}));await page.goto('/');await page.locator('[data-section="decks"]').click();await expect(page.locator('#scan-decks')).toBeDisabled();await expect(page.locator('#scan-status')).toContainText('Local scanning is unavailable');
  await page.unroute('**/api/decks/capabilities');await page.route('**/api/decks/scan',route=>route.fulfill({status:500,json:{error:'Broken.pdf: Expected exactly two pages; found 1. Catalog retained.'}}));await page.reload();await page.locator('[data-section="decks"]').click();await expect(page.locator('#scan-decks')).toBeEnabled();await page.locator('#scan-decks').click();await expect(page.locator('#scan-status')).toContainText('Scan failed: Broken.pdf');await expect(page.locator('#scan-status')).not.toContainText('Scan complete!');
});
