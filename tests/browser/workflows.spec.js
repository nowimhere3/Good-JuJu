import {test,expect,chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const source=new URL('../../',import.meta.url);
const original=async name=>readFile(new URL('Vortex Cards-R1/'+name,source));
const card=page=>page.locator('#card-face');
async function openDetails(page){await page.locator('#details-open').click();await expect(page.locator('#details-dialog')).toBeVisible();}
async function choose(page,title){await page.locator('#search').fill(title);await page.locator('#grid .mini-card').first().click();}
test('full personal workflow, portable images, profile isolation and master expansion',async({page,browser},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('#count-all')).toHaveText('58');
  await expect(card(page).locator('img')).toHaveAttribute('src','assets/cards/r1/f1.jpg');
  await expect.poll(()=>card(page).locator('img').evaluate(im=>im.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#flip').click();await expect(card(page).locator('img')).toHaveAttribute('src','assets/cards/r1/b1.jpg');
  await expect.poll(()=>card(page).locator('img').evaluate(im=>im.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#flip').click();
  await page.screenshot({path:`test-results/${testInfo.project.name}-home.png`,fullPage:true});
  const draws=[];for(let i=0;i<8;i++){await page.locator('#shuffle').click();await expect(page.locator('#shuffle')).not.toHaveAttribute('aria-busy','true');draws.push(await page.locator('#card-title').textContent());}expect(new Set(draws).size).toBe(8);
  await page.locator('#favorite').click();await expect(page.locator('#favorite')).toHaveAttribute('aria-pressed','true');
  await openDetails(page);await page.locator('#detail-title').fill('My R1 reflection');await page.locator('#detail-tags').fill('Ease, Abundance, Ease');await page.getByRole('button',{name:'Save changes'}).click();
  await page.locator('[data-section="favorites"]').click();await expect(page.locator('#grid .mini-card')).toHaveCount(1);
  await page.locator('[data-section="tags"]').click();await page.locator('#tags-list [data-tag="Ease"]').click();await expect(page.locator('#grid .mini-card')).toHaveCount(1);
  await page.locator('#kind').selectOption('digital');await expect(page.locator('#empty')).toBeVisible();await page.locator('#reset').click();await expect(page.locator('#count-all')).toHaveText('58');
  await choose(page,'My R1 reflection');await openDetails(page);await page.locator('#archive-card').click();await expect(page.locator('#count-all')).toHaveText('57');
  await page.locator('#reset').click();await page.locator('[data-section="archive"]').click();await expect(page.locator('#grid .mini-card')).toHaveCount(1);await expect(page.locator('#shuffle')).toBeDisabled();
  await openDetails(page);await page.locator('#archive-card').click();await page.locator('#reset').click();await expect(page.locator('#count-all')).toHaveText('58');
  await choose(page,'My R1 reflection');await page.locator('#favorite').click();await expect(page.locator('#count-favorites')).toHaveText('0');await page.locator('#favorite').click();
  await page.locator('#add-open').click();await page.locator('#custom-form [name=title]').fill('A quiet beginning');await page.locator('#custom-form [name=front]').fill('I make space for possibility.');await page.locator('#custom-form [name=back]').fill('First paragraph.\n\nAnother paragraph for contemplation.');await page.locator('#custom-form [name=background]').fill('#603d68');await page.getByRole('button',{name:'Create card',exact:true}).click();
  await expect(page.locator('#card-title')).toHaveText('A quiet beginning');await expect(card(page)).toContainText('I make space');
  await openDetails(page);await page.locator('#detail-front').fill('A personally edited front.');await page.locator('#detail-tags').fill('Ease, Stillness');await page.getByRole('button',{name:'Save changes'}).click();await expect(card(page)).toContainText('A personally edited front.');
  await openDetails(page);await page.locator('#detail-tags').fill('Ease');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.locator('#details-dialog')).toBeHidden();await expect(page.locator('#tag-nav [data-tag="Stillness"]')).toHaveCount(0);
  await page.locator('#flip').click();await expect(card(page)).toContainText('Another paragraph');await page.locator('#favorite').click();await expect(page.locator('#favorite')).toHaveAttribute('aria-pressed','true');
  await page.reload();await expect(page.locator('#count-all')).toHaveText('59');await choose(page,'A quiet beginning');await expect(card(page)).toContainText('A personally edited front.');await expect(page.locator('#favorite')).toHaveAttribute('aria-pressed','true');
  await page.locator('#add-open').click();await page.locator('[data-method=docs]').click();await page.locator('#docs-text').fill('First contemplation\n\nOne paragraph.\n\nSecond paragraph.\n\n==========\n\nSecond contemplation\n\nA description.');await page.locator('#docs-preview').click();await expect(page.locator('#docs-preview-list .preview-row')).toHaveCount(2);await page.locator('#docs-import').click();await expect(page.locator('#count-all')).toHaveText('61');
  await page.locator('#add-open').click();await page.locator('[data-method=physical]').click();
  const files=[{name:'F101.JPG',mimeType:'image/jpeg',buffer:await original('F1.jpg')},{name:'b101.jpg',mimeType:'image/jpeg',buffer:await original('B1.jpg')},{name:'F102.jpg',mimeType:'image/jpeg',buffer:await original('f2.jpg')}];
  await page.locator('#physical-files').setInputFiles(files);await expect(page.locator('#physical-preview')).toContainText('1 complete pair(s) ready');await expect(page.locator('#physical-preview')).toContainText('0 back(s)');await page.locator('#physical-import').click();await expect(page.locator('#count-all')).toHaveText('62');await expect(card(page).locator('img')).toHaveAttribute('src',/^data:image/);await page.locator('#flip').click();await expect.poll(()=>card(page).locator('img').evaluate(im=>im.naturalWidth)).toBeGreaterThan(0);
  // Reimporting the exact images cannot overwrite or duplicate an existing personal pair.
  await page.locator('#add-open').click();await page.locator('#physical-files').setInputFiles(files.slice(0,2));await expect(page.locator('#physical-preview')).toContainText('Already imported');await page.locator('#physical-import').click();await expect(page.locator('#add-dialog')).toBeHidden();await expect(page.locator('#count-all')).toHaveText('62');
  await page.locator('#kind').selectOption('physical');await expect(page.locator('#grid .mini-card')).toHaveCount(59);await page.locator('#kind').selectOption('digital');await expect(page.locator('#grid .mini-card')).toHaveCount(3);await page.locator('#reset').click();
  // Persist an archived personal card into the portable backup.
  await choose(page,'Second contemplation');await openDetails(page);await page.locator('#archive-card').click();await page.locator('#reset').click();await expect(page.locator('#count-archive')).toHaveText('1');
  await page.locator('#backup-open').click();const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const exported=JSON.parse(await readFile(await download.path(),'utf8'));expect(exported.personal.cards).toHaveLength(4);expect(exported.personal.cards.find(c=>c.kind==='physical').back).toMatch(/^data:image/);
  const other=await browser.newContext();const independent=await other.newPage();await independent.goto('http://127.0.0.1:4173');await expect(independent.locator('#count-all')).toHaveText('58');await expect(independent.locator('#count-favorites')).toHaveText('0');await expect(independent.locator('#count-archive')).toHaveText('0');
  await independent.locator('#backup-open').click();await independent.locator('#restore-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await expect(independent.locator('#restore-preview')).toContainText('Validated 4 personal card(s)');await independent.locator('#restore').click();await expect(independent.locator('#count-all')).toHaveText('61');await expect(independent.locator('#count-archive')).toHaveText('1');await expect(independent.locator('#count-favorites')).toHaveText('2');
  await choose(independent,'A quiet beginning');await expect(card(independent)).toContainText('A personally edited front.');await independent.reload();await expect(independent.locator('#count-all')).toHaveText('61');await choose(independent,'Card 101');await expect.poll(()=>card(independent).locator('img').evaluate(im=>im.naturalWidth)).toBeGreaterThan(0);await independent.locator('#flip').click();await expect.poll(()=>card(independent).locator('img').evaluate(im=>im.naturalWidth)).toBeGreaterThan(0);
  // A newly packaged master card appears while personal overrides survive.
  const library=JSON.parse(await readFile(new URL('data/cards.json',source),'utf8'));library.cards.push({...library.cards[0],id:'r1-059',title:'Master expansion test fixture'});
  await independent.route('**/data/cards.json',route=>route.fulfill({json:library}));await independent.reload();await expect(independent.locator('#count-all')).toHaveText('62');await choose(independent,'My R1 reflection');await expect(independent.locator('#favorite')).toHaveAttribute('aria-pressed','true');
  await other.close();expect(errors).toEqual([]);
  await page.locator('#backup-dialog [data-close]').click();await page.locator('#reset').click();await page.screenshot({path:`test-results/${testInfo.project.name}-personal.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('all 116 packaged card faces decode, including the converted legacy JPEG fronts',async({page})=>{
  await page.goto('/');
  const results=await page.evaluate(async()=>{
    const library=await (await fetch('data/cards.json')).json();const failures=[];
    for(const c of library.cards)for(const side of ['front','back']){const im=new Image();im.src=c[side];try{await im.decode();if(!im.naturalWidth)failures.push(c[side]);}catch{failures.push(c[side]);}}
    return failures;
  });expect(results).toEqual([]);
  for(const number of [32,37]){await choose(page,`Card ${number}`);await expect(card(page).locator('img')).toHaveAttribute('src',`assets/cards/r1/f${number}.jpg`);await page.locator('#flip').click();await expect(card(page).locator('img')).toHaveAttribute('src',`assets/cards/r1/b${number}.jpg`);}
});
test('invalid restore never changes state and Docs preview must match current text',async({page})=>{
  await page.goto('/');await expect(page.locator('#count-all')).toHaveText('58');await page.locator('#backup-open').click();await page.locator('#restore-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"wrong"}')});await expect(page.locator('#backup-dialog [role=alert]')).toContainText('not a supported');await expect(page.locator('#restore')).toBeHidden();await page.locator('#backup-dialog [data-close]').click();await expect(page.locator('#count-all')).toHaveText('58');
  await page.locator('#add-open').click();await page.locator('[data-method=docs]').click();await page.locator('#docs-text').fill('Title\nDescription');await page.locator('#docs-preview').click();await expect(page.locator('#docs-import')).toBeVisible();await page.locator('#docs-text').fill('Changed');await expect(page.locator('#docs-import')).toBeHidden();
});
test('built static app works at a subpath and provides an enlarged readable view',async({page})=>{
  await page.goto('/dist/');await expect(page.locator('#count-all')).toHaveText('58');await expect.poll(()=>card(page).locator('img').evaluate(im=>im.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#enlarge').click();await expect(page.locator('#expanded-face img')).toHaveAttribute('src','assets/cards/r1/f1.jpg');await page.locator('#expanded-flip').click();await expect(page.locator('#expanded-face img')).toHaveAttribute('src','assets/cards/r1/b1.jpg');await page.locator('#minimize').click();await expect(page.locator('#side-label')).toHaveText('BACK');
});
test('persistent browser profiles keep independent state across browser restarts',async({},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop','Storage isolation is independent of viewport.');
  const profileA=testInfo.outputPath('profile-a'),profileB=testInfo.outputPath('profile-b');
  let a=await chromium.launchPersistentContext(profileA,{headless:true});
  let b;
  try{
    const page=a.pages()[0];await page.goto('http://127.0.0.1:4173');await expect(page.locator('#count-all')).toHaveText('58');await page.locator('#favorite').click();await expect(page.locator('#count-favorites')).toHaveText('1');await page.locator('#theme-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('#settings-open').click();await page.locator('#reveal-effect').selectOption('super');await page.locator('#reveal-duration').fill('3.5');await page.locator('#default-experience-section summary').click();await page.locator('#default-view').selectOption('enlarged');await page.locator('#apply-settings').click();await expect(page.locator('#settings-status')).toHaveText('✓ Settings Saved');await a.close();a=null;
    b=await chromium.launchPersistentContext(profileB,{headless:true});const independent=b.pages()[0];await independent.goto('http://127.0.0.1:4173');await expect(independent.locator('#count-favorites')).toHaveText('0');await expect(independent.locator('html')).toHaveAttribute('data-theme','light');await b.close();b=null;
    a=await chromium.launchPersistentContext(profileA,{headless:true});const reopened=a.pages()[0];await reopened.goto('http://127.0.0.1:4173');await expect(reopened.locator('#count-favorites')).toHaveText('1');await expect(reopened.locator('#favorite')).toHaveAttribute('aria-pressed','true');await expect(reopened.locator('html')).toHaveAttribute('data-theme','dark');await expect(reopened.locator('#expanded-dialog')).toBeVisible();await reopened.locator('#expanded-settings').click();await expect(reopened.locator('#reveal-effect')).toHaveValue('super');await expect(reopened.locator('#reveal-duration')).toHaveValue('3.5');
  }finally{await a?.close();await b?.close();}
});
