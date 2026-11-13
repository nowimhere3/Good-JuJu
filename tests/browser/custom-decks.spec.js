import {test,expect} from '@playwright/test';
const catalog=page=>page.evaluate(()=>fetch('/data/cards.json').then(r=>r.json()));
const seedRandom=(page,value)=>page.addInitScript(v=>{Math.random=()=>v;},value);
const deckOfCurrent=async(page,cards)=>{const title=await page.locator('#card-title').textContent();return cards.find(c=>c.title===title)?.deckId;};

test('custom multi-deck selection: pills, counts, pool, transitions, no-repeat, persistence',async({page})=>{
  test.setTimeout(300000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const lib=await catalog(page);
  const deckIds=lib.decks.map(d=>d.id);
  const total=deckIds.length+1; // plus "My cards"
  const activeCount=ids=>lib.cards.filter(c=>ids.includes(c.deckId)).length;
  await expect(page.locator('#count-all')).toHaveText(String(lib.cards.length));
  await page.locator('[data-section="decks"]').click();
  await expect(page.locator('.deck-pill')).toHaveCount(0); // pills only in Custom mode
  await expect(page.locator('#custom-count')).toBeHidden();
  await page.locator('#custom-toggle').click();
  await expect(page.locator('.deck-pill')).toHaveCount(total);
  await expect(page.locator('#custom-count')).toHaveText(`${total}/${total}`); // default: every deck included
  await page.locator('#custom-none').click();
  await expect(page.locator('#custom-count')).toHaveText(`0/${total}`);
  await expect(page.locator('#shuffle')).toBeDisabled();
  await expect(page.locator('#empty-message')).toContainText('No decks are selected');
  const pick=[deckIds[0],deckIds[2]];
  for(const id of pick)await page.locator(`[data-pick="${id}"]`).click();
  await expect(page.locator('#custom-count')).toHaveText(`2/${total}`);
  for(const id of pick)await expect(page.locator(`[data-pick="${id}"]`)).toHaveAttribute('aria-checked','true');
  await expect(page.locator(`[data-pick="${deckIds[1]}"]`)).toHaveAttribute('aria-checked','false');
  await expect(page.locator('#card-position')).toHaveText(`${activeCount(pick)} cards`);
  // no-repeat: draw the whole pool, every card exactly once, only from chosen decks
  await page.locator('#no-repeat').check();
  const seen=[];
  for(let i=0;i<activeCount(pick);i++){
    await page.locator('#shuffle').click();
    await expect(page.locator('#shuffle')).toBeEnabled();
    seen.push(await page.locator('#card-title').textContent()+'|'+await page.locator('#card-face img').getAttribute('src'));
  }
  expect(new Set(seen).size).toBe(seen.length);
  const srcDecks=new Set(seen.map(s=>lib.cards.find(c=>c.front===s.split('|')[1])?.deckId));
  expect([...srcDecks].every(d=>pick.includes(d))).toBe(true);
  // reload keeps saved ids, starts in All Decks mode; re-entering Custom restores them
  await page.reload();
  await expect(page.locator('#selection-label')).toHaveText('All active cards');
  await page.locator('[data-section="decks"]').click();
  await page.locator('#custom-toggle').click();
  await expect(page.locator('#custom-count')).toHaveText(`2/${total}`);
  // transitions: custom -> single -> all -> custom
  await page.locator(`[data-deck="${deckIds[3]}"]`).click();
  await expect(page.locator('#custom-count')).toBeHidden();
  await expect(page.locator('#card-position')).toHaveText(`${activeCount([deckIds[3]])} cards`);
  await page.locator('#all-decks').click();
  await expect(page.locator('#card-position')).toHaveText(`${lib.cards.length} cards`);
  await page.locator('#deck-select').selectOption('__custom');
  await expect(page.locator('#custom-count')).toHaveText(`2/${total}`);
  await expect(page.locator('#card-position')).toHaveText(`${activeCount(pick)} cards`);
  await page.locator('[data-section="all"]').click();
  await expect(page.locator('#card-position')).toHaveText(`${lib.cards.length} cards`);
  // Favorites / archive remain global even if custom had been active
  const stored=await page.evaluate(()=>localStorage.getItem('vortex-custom-decks'));
  expect(JSON.parse(stored)).toEqual(pick);
});

test('random startup differs across loads and never selects an archived card',async({browser})=>{
  test.setTimeout(240000);
  const titles=new Set();
  for(const r of [0,0.31,0.62,0.99]){
    const ctx=await browser.newContext();const page=await ctx.newPage();
    await seedRandom(page,r);
    await page.goto('/');
    await expect(page.locator('#card-title')).not.toHaveText('—');
    titles.add(await page.locator('#card-title').textContent());
    await expect(page.locator('.sparkle-transition')).toHaveCount(0);
    await expect(page.locator('#shuffle-status')).toContainText('0 of');
    await ctx.close();
  }
  expect(titles.size).toBeGreaterThan(2);
  // archive the card shown for random=0, reload with same seed: must be a different card
  const ctx=await browser.newContext();const page=await ctx.newPage();
  await seedRandom(page,0);await page.goto('/');
  const t0=await page.locator('#card-title').textContent();
  await page.locator('#details-open').click();
  await page.locator('#archive-card').click();
  await page.reload();
  await expect(page.locator('#card-title')).not.toHaveText(t0);
  await expect(page.locator('#count-archive')).toHaveText('1');
  await ctx.close();
});

test('real randomness: random cards across loads come from several decks (no seeding)',async({browser})=>{
  const ctx=await browser.newContext();const page=await ctx.newPage();
  await page.goto('/');const lib=await catalog(page);
  const decks=new Set();
  for(let i=0;i<8;i++){await page.reload();await expect(page.locator('#card-title')).not.toHaveText('—');decks.add(await deckOfCurrent(page,lib.cards));}
  expect(decks.size).toBeGreaterThan(1);
  await ctx.close();
});

test('enlarged startup preference still opens on the random card',async({page})=>{
  await seedRandom(page,0.5);
  await page.goto('/');
  const title=await page.locator('#card-title').textContent();
  await page.evaluate(()=>{const k='vortex-preferences-v2';localStorage.setItem(k,JSON.stringify({...JSON.parse(localStorage.getItem(k)||'{}'),version:2,defaultView:'enlarged'}));});
  await page.reload();
  await expect(page.locator('#expanded-dialog')).toBeVisible();
  await expect(page.locator('#expanded-title')).toHaveText(title);
});
