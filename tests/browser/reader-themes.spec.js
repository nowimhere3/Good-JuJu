import {test,expect} from '@playwright/test';

async function ready(page){await page.goto('/');await expect(page.locator('#count-all')).toHaveText('58');}
async function readerFits(page){
  await expect.poll(()=>page.locator('#expanded-face img').evaluate(im=>im.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>{
    const card=document.querySelector('#expanded-card'),im=card.querySelector('img');
    return Math.abs(card.clientWidth/card.clientHeight-im.naturalWidth/im.naturalHeight);
  })).toBeLessThan(.01);
  const geometry=await page.evaluate(()=>{
    const dialog=document.querySelector('#expanded-dialog'),card=document.querySelector('#expanded-card').getBoundingClientRect(),footer=document.querySelector('#expanded-controls').getBoundingClientRect();
    return {fits:footer.bottom<=innerHeight&&card.top>=0&&card.left>=0&&card.right<=innerWidth,scroll:dialog.scrollHeight-dialog.clientHeight,gap:footer.top-card.bottom,overflow:document.documentElement.scrollWidth-innerWidth,buttons:[...document.querySelectorAll('#expanded-controls button')].map(b=>({height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width}))};
  });
  expect(geometry.fits).toBe(true);expect(geometry.scroll).toBeLessThanOrEqual(1);expect(geometry.overflow).toBeLessThanOrEqual(0);expect(geometry.gap).toBeGreaterThanOrEqual(7);expect(geometry.gap).toBeLessThanOrEqual(13);
  for(const b of geometry.buttons){expect(b.height).toBeGreaterThanOrEqual(44);expect(b.width).toBeGreaterThan(70);}
}
test('immersive reader retains state, favorites, filters and consecutive draws',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  // A three-card tag pool makes it possible to prove the reader respects the existing filter.
  for(let i=1;i<=3;i++){
    await page.locator('#search').fill(`Card 0${i}`);await page.locator('#details-open').click();await page.locator('#detail-tags').fill('Reader selection');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.locator('#details-dialog')).toBeHidden();
  }
  await page.locator('#reset').click();await page.locator('#tag-nav [data-tag="Reader selection"]').click();await expect(page.locator('#grid .mini-card')).toHaveCount(3);
  await page.locator('#flip').click();await page.locator('#enlarge').click();
  await expect(page.locator('#expanded-dialog')).toBeVisible();await expect(page.locator('.topbar')).toBeHidden();await expect(page.locator('aside')).toBeHidden();await expect(page.locator('#expanded-flip')).toHaveText('Show front');
  await expect(page.locator('#expanded-face img')).toHaveAttribute('src','assets/cards/r1/b1.jpg');await readerFits(page);
  await page.locator('#expanded-favorite').click();await expect(page.locator('#expanded-favorite')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#favorite')).toHaveAttribute('aria-pressed','true');
  await page.locator('#expanded-flip').click();await expect(page.locator('#expanded-face img')).toHaveAttribute('src','assets/cards/r1/f1.jpg');
  const draws=[];for(let i=0;i<3;i++){await page.locator('#expanded-shuffle').click();await expect(page.locator('#expanded-shuffle')).not.toHaveAttribute('aria-busy','true');await expect(page.locator('#expanded-dialog')).toBeVisible();draws.push(await page.locator('#expanded-face img').getAttribute('src'));}
  expect(new Set(draws).size).toBe(3);expect(draws.every(s=>/\/f[123]\.jpg$/.test(s))).toBe(true);
  const selected=await page.locator('#expanded-face img').getAttribute('src');
  await page.locator('#expanded-details').click();await expect(page.locator('#details-dialog')).toBeVisible();await page.locator('#details-dialog [data-close]').click();await expect(page.locator('#expanded-dialog')).toBeVisible();await expect(page.locator('#expanded-face img')).toHaveAttribute('src',selected);
  // Saving a personal title updates the reader without closing it.
  await page.locator('#expanded-details').click();await page.locator('#detail-title').fill('Reader personal title');await page.getByRole('button',{name:'Save changes'}).click();await expect(page.locator('#details-dialog')).toBeHidden();await expect(page.locator('#expanded-title')).toHaveText('Reader personal title');
  await page.screenshot({path:testInfo.outputPath('reader-light.png')});await readerFits(page);
  await page.locator('#minimize').click();await expect(page.locator('#expanded-dialog')).toBeHidden();await expect(page.locator('.topbar')).toBeVisible();await expect(page.locator('#selection-label')).toHaveText('Tag: Reader selection');await expect(page.locator('#card-face img')).toHaveAttribute('src',selected);await expect(page.locator('#card-title')).toHaveText('Reader personal title');
  await page.locator('#theme-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('#enlarge').click();await page.screenshot({path:testInfo.outputPath('reader-dark.png')});await readerFits(page);
  // Small phones and landscape rotations keep every footer button visible.
  for(const viewport of [{width:320,height:568},{width:568,height:320}]){await page.setViewportSize(viewport);await readerFits(page);await page.screenshot({path:testInfo.outputPath(`reader-${viewport.width}x${viewport.height}.png`)});}
  await page.keyboard.press('Escape');await expect(page.locator('#expanded-dialog')).toBeHidden();await expect(page.locator('#enlarge')).toBeFocused();expect(errors).toEqual([]);
});

test('themes persist without modifying existing personal data or authored colors',async({page,browser},testInfo)=>{
  await ready(page);
  const oldBackup={format:'into-the-vortex',version:1,personal:{cards:[{id:'user-theme-fixture',kind:'digital',collection:'Personal digital cards',title:'Keep my colors',front:'A personal front',back:'My paragraphs.\n\n'+('A reflection worth keeping. '.repeat(90)),background:'#603d68',color:'#fff8e9'}],overrides:{'r1-001':{title:'An existing personal title',favorite:true,tags:['Ease','Abundance']},'r1-002':{archived:true}},settings:{noRepeat:false}}};
  await page.locator('#backup-open').click();await page.locator('#restore-file').setInputFiles({name:'v1-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oldBackup))});await expect(page.locator('#restore')).toBeVisible();await page.locator('#restore').click();await expect(page.locator('#backup-dialog')).toBeHidden();
  const readPersonal=()=>page.evaluate(async()=>{const {readPersonal}=await import('/app/storage.js');return readPersonal();});
  const before=await readPersonal();expect(before).toEqual(oldBackup.personal);
  await page.locator('#theme-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed','true');expect(await readPersonal()).toEqual(before);
  await page.screenshot({path:testInfo.outputPath('application-dark.png')});
  // No CSS filter is applied to scanned artwork in the dark palette.
  await expect(page.locator('#card-face img')).toHaveCSS('filter','none');
  await page.locator('#add-open').click();await expect(page.locator('#add-dialog')).toHaveCSS('background-color','rgb(25, 44, 39)');await page.screenshot({path:testInfo.outputPath('management-dark.png')});await page.locator('#add-dialog [data-close]').click();
  await page.locator('#kind').selectOption('digital');await expect(page.locator('#card-face .digital-face')).toHaveCSS('background-color','rgb(96, 61, 104)');await expect(page.locator('#card-face .digital-face')).toHaveCSS('color','rgb(255, 248, 233)');
  await page.locator('#enlarge').click();await expect(page.locator('#expanded-face .digital-face')).toHaveCSS('background-color','rgb(96, 61, 104)');await page.locator('#expanded-flip').click();await expect(page.locator('#expanded-face')).toContainText('My paragraphs.');await expect(page.locator('#expanded-face .digital-face')).toHaveCSS('color','rgb(255, 248, 233)');
  await page.locator('#expanded-details').click();await expect(page.locator('#details-dialog')).toHaveCSS('background-color','rgb(25, 44, 39)');await page.locator('#details-dialog [data-close]').click();await page.locator('#minimize').click();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('#count-all')).toHaveText('58');expect(await readPersonal()).toEqual(before);
  const separate=await browser.newContext();try{const other=await separate.newPage();await other.goto('http://127.0.0.1:4173');await expect(other.locator('html')).toHaveAttribute('data-theme','light');await expect(other.locator('#count-all')).toHaveText('58');await expect(other.locator('#count-favorites')).toHaveText('0');}finally{await separate.close();}
  await page.locator('#theme-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');expect(await readPersonal()).toEqual(before);
});
