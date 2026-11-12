import {test,expect} from '@playwright/test';
const effects=['light','classic','super','stardust','prismatic','comet'];
const directions=['ltr','rtl','ttb','btt','tl-br','tr-bl','bl-tr','br-tl'];
async function prefs(page,value){await page.evaluate(v=>localStorage.setItem('vortex-preferences-v2',JSON.stringify({version:2,effect:'classic',direction:'ltr',duration:1100,defaultView:'normal',...v})),value);}
async function finish(page){await page.evaluate(()=>document.querySelectorAll('.sparkle-transition').forEach(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish())));await expect(page.locator('.sparkle-transition')).toHaveCount(0);await expect(page.locator('#flip')).toBeEnabled();}
async function personal(page){return page.evaluate(async()=>{const s=await import('/app/storage.js');return s.readPersonal();});}
test('both flip directions reuse all presets, eight geometries and saved durations for JPEG, PDF and digital faces in both views',async({page},info)=>{
  test.setTimeout(180000);await page.goto('/');await expect(page.locator('#count-all')).toHaveText('118');
  await page.evaluate(async()=>{const s=await import('/app/storage.js');await s.mutatePersonal(p=>({...p,cards:[...p.cards,{id:'user-flip-fixture',kind:'digital',deckId:'personal',title:'Digital flip',front:'Front reflection',back:'Back reflection',background:'#214f49',color:'#fff8e9'}]}));});await page.reload();
  const catalog=await page.evaluate(()=>fetch('/data/cards.json').then(r=>r.json()));const pdf=catalog.cards.find(c=>c.sourceType==='pdf');
  let iteration=0;
  for(const [id,deck] of [['r1-032','r1'],[pdf.id,pdf.deckId],['user-flip-fixture','personal']]){
    await page.locator('#deck-select').selectOption(deck);await page.locator(`[data-card="${id}"]`).click();const title=await page.locator('#card-title').textContent(),before=await personal(page),bag=await page.locator('#shuffle-status').textContent();
    for(const enlarged of [false,true]){
      if(enlarged)await page.locator('#enlarge').click();const button=page.locator(enlarged?'#expanded-flip':'#flip');
      for(const effect of effects){for(const back of [true,false]){
        const direction=directions[iteration%8],duration=[500,1300,3500][iteration%3];iteration++;
        await prefs(page,{effect,direction,duration});await button.click();const layer=page.locator('.sparkle-transition');await expect(layer).toHaveCount(1);
        await page.evaluate(()=>document.querySelector('.sparkle-transition').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=100;}));
        await expect(layer).toHaveAttribute('data-effect',effect);await expect(layer).toHaveAttribute('data-direction',direction);await expect(layer).toHaveCSS('overflow','hidden');
        expect(await layer.evaluate(el=>el.getAnimations({subtree:true}).every(a=>a.effect.getTiming().duration===Number(localStorage.getItem('vortex-preferences-v2')&&JSON.parse(localStorage.getItem('vortex-preferences-v2')).duration)))).toBe(true);
        await expect(button).toBeDisabled();await expect(page.locator(enlarged?'#expanded-favorite':'#favorite')).toBeEnabled();
        const face=page.locator(enlarged?'#expanded-face':'#card-face');
        if(id==='user-flip-fixture')await expect(face).toContainText(back?'Back reflection':'Front reflection');
        else{const card=catalog.cards.find(c=>c.id===id);await expect(face.locator('img')).toHaveAttribute('src',card[back?'back':'front']);await expect(layer.locator('img')).toHaveAttribute('src',card[back?'front':'back']);}
        if(effect==='comet'&&back&&enlarged&&id==='r1-032')await page.screenshot({path:info.outputPath('flip-midpoint.png')});
        await finish(page);await expect(page.locator('#card-title')).toHaveText(title);await expect(page.locator('#deck-select')).toHaveValue(deck);await expect(page.locator('#shuffle-status')).toHaveText(bag);
      }}
      if(enlarged){await expect(page.locator('#expanded-dialog')).toBeVisible();await page.locator('#minimize').click();}
    }
    expect(await personal(page)).toEqual(before);
  }
});
test('rapid interactions, shuffle sequencing, independent random choices, cancellation and reduced motion preserve state',async({page})=>{
  await page.goto('/');await page.locator('#deck-select').selectOption('r1');await prefs(page,{effect:'random',direction:'random',duration:3500});
  await page.evaluate(()=>{const values=[0,0,4294967295,4294967295];crypto.getRandomValues=a=>{a[0]=values.shift()??0;return a;};});
  await page.locator('#flip').click();await expect(page.locator('.sparkle-transition')).toHaveAttribute('data-effect','light');await expect(page.locator('.sparkle-transition')).toHaveAttribute('data-direction','ltr');
  await page.evaluate(()=>{for(let i=0;i<8;i++){document.querySelector('#flip').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#shuffle').dispatchEvent(new MouseEvent('click',{bubbles:true}));}});await expect(page.locator('.sparkle-transition')).toHaveCount(1);await finish(page);await expect(page.locator('#side-label')).toHaveText('BACK');await expect(page.locator('#shuffle-status')).toContainText('0 of 58');
  await page.locator('#flip').click();await expect(page.locator('.sparkle-transition')).toHaveAttribute('data-effect','comet');await expect(page.locator('.sparkle-transition')).toHaveAttribute('data-direction','br-tl');await finish(page);
  await page.locator('#shuffle').click();await expect(page.locator('.sparkle-transition')).toHaveCount(1);await finish(page);await expect(page.locator('#shuffle-status')).toContainText('1 of 58');
  const front=await page.locator('#card-face img').getAttribute('src');await page.locator('#flip').click();await expect(page.locator('.sparkle-transition')).toHaveCount(1);await finish(page);await expect(page.locator('#shuffle-status')).toContainText('1 of 58');await expect(page.locator('#card-face img')).not.toHaveAttribute('src',front);
  await page.locator('#flip').click();await expect(page.locator('.sparkle-transition')).toHaveCount(1);await page.locator('#settings-open').click();await expect(page.locator('.sparkle-transition')).toHaveCount(0);await page.locator('#close-settings').click();await expect(page.locator('#side-label')).toHaveText('FRONT');
  await page.locator('#enlarge').click();await page.locator('#expanded-flip').click();await expect(page.locator('.sparkle-transition')).toHaveCount(1);await page.locator('#minimize').click();await expect(page.locator('.sparkle-transition')).toHaveCount(0);await expect(page.locator('#side-label')).toHaveText('BACK');
  await page.locator('#flip').click();await expect(page.locator('.sparkle-transition')).toHaveCount(1);await page.locator('#search').fill('Card 32');await expect(page.locator('.sparkle-transition')).toHaveCount(0);await expect(page.locator('#card-face img')).toHaveAttribute('src','assets/cards/r1/f32.jpg');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#flip').click();await expect(page.locator('#side-label')).toHaveText('BACK');await expect(page.locator('.sparkle-transition')).toHaveCount(0);await expect(page.locator('#flip')).toBeEnabled();
});
test('failed or cancelled incoming decode retains the old face and releases all controls',async({page})=>{
  await page.route('**/data/cards.json',async route=>{const response=await route.fetch(),c=await response.json();c.cards.find(c=>c.id==='r1-032').back='assets/flip-delayed.jpg';await route.fulfill({json:c});});
  let release;let gate=new Promise(r=>release=r);await page.route('**/assets/flip-delayed.jpg',async route=>{await gate;await route.fulfill({status:404,body:'Missing image'});});
  await page.goto('/');await page.locator('#deck-select').selectOption('r1');await page.locator('[data-card="r1-032"]').click();const before=await personal(page);await page.locator('#flip').click();await expect(page.locator('#flip')).toHaveAttribute('aria-busy','true');await expect(page.locator('#side-label')).toHaveText('FRONT');await expect(page.locator('.sparkle-transition')).toHaveCount(0);release();await expect(page.locator('#flip')).toBeEnabled();await expect(page.locator('#side-label')).toHaveText('FRONT');await expect(page.locator('#card-face img')).toHaveAttribute('src','assets/cards/r1/f32.jpg');
  gate=new Promise(r=>release=r);await page.locator('#flip').click();await expect(page.locator('#flip')).toBeDisabled();await page.locator('#search').fill('Card 37');release();await expect(page.locator('#flip')).toBeEnabled();await expect(page.locator('#card-face img')).toHaveAttribute('src','assets/cards/r1/f37.jpg');await expect(page.locator('.sparkle-transition')).toHaveCount(0);expect(await personal(page)).toEqual(before);
});
