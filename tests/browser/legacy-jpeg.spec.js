import {test,expect} from '@playwright/test';
test('converted R1 JPEG fronts and original backs display and flip in both readers',async({page},info)=>{
  await page.goto('/');await expect(page.locator('#count-all')).toHaveText(String(await page.evaluate(()=>fetch('/data/cards.json').then(r=>r.json()).then(c=>c.cards.length))));
  for(const n of [32,37]){
    await page.locator(`[data-card="r1-0${n}"]`).click();
    for(const enlarged of [false,true]){
      if(enlarged)await page.locator('#enlarge').click();
      const face=page.locator(enlarged?'#expanded-face img':'#card-face img');
      const flip=page.locator(enlarged?'#expanded-flip':'#flip');
      await expect(face).toHaveAttribute('src',`assets/cards/r1/f${n}.jpg`);
      await expect.poll(()=>face.evaluate(im=>im.complete&&im.naturalWidth>2800)).toBe(true);
      await expect(face).toHaveCSS('object-fit','contain');
      if(enlarged)await expect.poll(()=>face.evaluate(im=>Math.abs(im.naturalWidth/im.naturalHeight-im.getBoundingClientRect().width/im.getBoundingClientRect().height))).toBeLessThan(.01);
      await page.screenshot({path:info.outputPath(`card-${n}-${enlarged?'enlarged':'normal'}.png`)});
      await flip.click();await expect(face).toHaveAttribute('src',`assets/cards/r1/b${n}.jpg`);await expect.poll(()=>face.evaluate(im=>im.complete&&im.naturalWidth>0)).toBe(true);
      await flip.click();await expect(face).toHaveAttribute('src',`assets/cards/r1/f${n}.jpg`);
      if(enlarged)await page.locator('#minimize').click();
    }
  }
});
