import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
async function ready(page){await page.goto('/');await expect(page.locator('#count-all')).toHaveText('58');await page.evaluate(()=>{Math.random=()=>.4;});}
async function pauseAt(page,time){
  await page.evaluate(t=>document.querySelector('.sparkle-transition').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t;}),time);
}
async function finish(page,button){await page.evaluate(()=>document.querySelector('.sparkle-transition')?.getAnimations({subtree:true}).forEach(a=>a.finish()));await expect(page.locator(button)).not.toHaveAttribute('aria-busy','true');await expect(page.locator('.sparkle-transition')).toHaveCount(0);}
test('normal shuffle keeps old image during decode and progressively reveals behind the wave',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const library=JSON.parse(await readFile(new URL('data/cards.json',root),'utf8'));library.cards[23].front='assets/delayed-front.jpg';
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/data/cards.json',route=>route.fulfill({json:library}));
  await page.route('**/assets/delayed-front.jpg',async route=>{await gate;await route.fulfill({contentType:'image/jpeg',body:await readFile(new URL('assets/cards/r1/f24.jpg',root))});});
  await ready(page);await page.locator('#flip').click();await expect.poll(()=>page.locator('#card-face img').evaluate(im=>im.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#shuffle').click();await expect(page.locator('#shuffle')).toHaveAttribute('aria-busy','true');await expect(page.locator('#card-face img')).toHaveAttribute('src','assets/cards/r1/b1.jpg');await expect(page.locator('.sparkle-transition')).toHaveCount(0);
  release();await expect(page.locator('#card .sparkle-transition')).toHaveCount(1);await pauseAt(page,0);
  await expect(page.locator('#card .sparkle-previous img')).toHaveAttribute('src','assets/cards/r1/b1.jpg');await expect(page.locator('#card-face img')).toHaveAttribute('src','assets/delayed-front.jpg');
  expect(await page.locator('.sparkle-previous').evaluate(el=>Number(getComputedStyle(el).clipPath.match(/polygon\(([-\d.]+)px/)[1]))).toBeLessThanOrEqual(0);
  await pauseAt(page,440);
  const geometry=await page.evaluate(()=>{
    const surface=document.querySelector('#card').getBoundingClientRect(),layer=document.querySelector('.sparkle-transition'),old=layer.querySelector('.sparkle-previous'),wave=layer.querySelector('.sparkle-wave').getBoundingClientRect();
    const progress=Number(getComputedStyle(old).clipPath.match(/polygon\(([-\d.]+)px/)[1])/surface.width;
    return {progress,error:Math.abs((wave.left+wave.right)/2-(surface.left+surface.width*progress)),overflow:getComputedStyle(layer).overflow,parent:layer.parentElement.id,duration:old.getAnimations()[0].effect.getTiming().duration,glints:layer.querySelectorAll('.sparkle-glint').length};
  });
  expect(geometry.progress).toBeGreaterThan(.1);expect(geometry.progress).toBeLessThan(.95);expect(geometry.error).toBeLessThan(2);expect(geometry.overflow).toBe('hidden');expect(geometry.parent).toBe('card');expect(geometry.duration).toBe(1100);expect(geometry.glints).toBe(8);
  await page.locator('#card').screenshot({path:testInfo.outputPath('normal-mid-sweep.png')});
  // Programmatic repeated clicks obey the same short guard as touch/click interactions.
  await page.evaluate(()=>{for(let i=0;i<5;i++)document.querySelector('#shuffle').click();});await expect(page.locator('#shuffle-status')).toContainText('1 of 58 drawn');
  await finish(page,'#shuffle');await expect(page.locator('#card-face img')).toHaveAttribute('src','assets/delayed-front.jpg');
  await page.locator('#shuffle').click();await expect(page.locator('.sparkle-transition')).toHaveCount(1);await pauseAt(page,200);await page.locator('#flip').click();await expect(page.locator('.sparkle-transition')).toHaveCount(0);await expect(page.locator('#shuffle')).not.toHaveAttribute('aria-busy','true');await expect(page.locator('#side-label')).toHaveText('BACK');await expect(page.locator('#shuffle-status')).toContainText('2 of 58 drawn');expect(errors).toEqual([]);
});
test('enlarged dark reader contains the sweep and minimizes cleanly during it',async({page},testInfo)=>{
  await ready(page);await page.locator('#theme-toggle').click();await page.locator('#enlarge').click();await page.locator('#expanded-shuffle').click();await expect(page.locator('#expanded-card .sparkle-transition')).toHaveCount(1);await pauseAt(page,240);
  await expect(page.locator('#expanded-face img')).toHaveAttribute('src','assets/cards/r1/f24.jpg');await expect(page.locator('#expanded-card .sparkle-previous img')).toHaveAttribute('src','assets/cards/r1/f1.jpg');
  await expect(page.locator('#expanded-dialog')).toBeVisible();await expect(page.locator('.layout')).toBeHidden();
  const bounds=await page.evaluate(()=>{const layer=document.querySelector('.sparkle-transition').getBoundingClientRect(),card=document.querySelector('#expanded-card').getBoundingClientRect();return {x:Math.abs(layer.x-card.x),y:Math.abs(layer.y-card.y),width:Math.abs(layer.width-card.width),height:Math.abs(layer.height-card.height)};});for(const delta of Object.values(bounds))expect(delta).toBeLessThan(1);
  await page.screenshot({path:testInfo.outputPath('enlarged-mid-sweep.png')});await page.locator('#minimize').click();await expect(page.locator('.sparkle-transition')).toHaveCount(0);await expect(page.locator('#shuffle')).not.toHaveAttribute('aria-busy','true');await expect(page.locator('#card-face img')).toHaveAttribute('src','assets/cards/r1/f24.jpg');
  await page.locator('#enlarge').click();await expect(page.locator('#expanded-face img')).toHaveAttribute('src','assets/cards/r1/f24.jpg');
});
test('reduced motion bypasses the effect and changing preference cancels an active sweep',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page);
  await page.locator('#shuffle').click();await expect(page.locator('#shuffle')).not.toHaveAttribute('aria-busy','true');await expect(page.locator('#card-face img')).toHaveAttribute('src','assets/cards/r1/f24.jpg');await expect(page.locator('.sparkle-transition')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#shuffle').click();await expect(page.locator('.sparkle-transition')).toHaveCount(1);await pauseAt(page,240);await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.sparkle-transition')).toHaveCount(0);await expect(page.locator('#shuffle')).not.toHaveAttribute('aria-busy','true');await expect(page.locator('#shuffle-status')).toContainText('2 of 58 drawn');
});
test('digital reveal preserves authored colors and the scrolled outgoing face',async({page})=>{
  const library={cards:[{id:'r1-001',kind:'digital',title:'Long text fixture',front:'A long contemplation. '.repeat(180),back:'Back one',background:'#603d68',color:'#fff8e9'},{id:'r1-002',kind:'digital',title:'Next fixture',front:'Next contemplation',back:'Back two',background:'#214f49',color:'#ffffff'}]};
  await page.route('**/data/cards.json',route=>route.fulfill({json:library}));await page.goto('/');await expect(page.locator('#count-all')).toHaveText('2');await page.evaluate(()=>{Math.random=()=>.8;document.querySelector('#card-face .digital-face').scrollTop=120;});
  const scroll=await page.locator('#card-face .digital-face').evaluate(el=>el.scrollTop);expect(scroll).toBeGreaterThan(0);
  await page.locator('#shuffle').click();await expect(page.locator('.sparkle-transition')).toHaveCount(1);await pauseAt(page,240);await expect(page.locator('.sparkle-previous .digital-face')).toHaveCSS('background-color','rgb(96, 61, 104)');expect(await page.locator('.sparkle-previous .digital-face').evaluate(el=>el.scrollTop)).toBe(scroll);await expect(page.locator('#card-face .digital-face')).toHaveCSS('background-color','rgb(33, 79, 73)');await finish(page,'#shuffle');await expect(page.locator('#card-face')).toContainText('Next contemplation');
});
test('filter changes cancel image preparation without consuming the draw or keeping controls busy',async({page})=>{
  const library=JSON.parse(await readFile(new URL('data/cards.json',root),'utf8'));library.cards[23].front='assets/held-front.jpg';
  let release;const gate=new Promise(resolve=>{release=resolve;});await page.route('**/data/cards.json',route=>route.fulfill({json:library}));
  await page.route('**/assets/held-front.jpg',async route=>{await gate;await route.fulfill({contentType:'image/jpeg',body:await readFile(new URL('assets/cards/r1/f24.jpg',root))});});
  await ready(page);await page.locator('#shuffle').click();await expect(page.locator('#shuffle')).toHaveAttribute('aria-busy','true');await page.locator('#search').fill('Card 01');await expect(page.locator('#shuffle')).not.toHaveAttribute('aria-busy','true');await expect(page.locator('#shuffle-status')).toContainText('0 of 1 drawn');await expect(page.locator('#card-face img')).toHaveAttribute('src','assets/cards/r1/f1.jpg');release();
});
