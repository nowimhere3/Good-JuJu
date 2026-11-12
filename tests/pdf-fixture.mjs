import {spawnSync} from 'node:child_process';
export function pdfFixture(pages=2,{encrypted=false,blankPassword=false,variant=0}={}){
  const r=spawnSync('python',['-c',`
import sys,pymupdf
doc=pymupdf.open()
for i in range(${pages}):
    page=doc.new_page(width=180,height=280)
    page.draw_rect(page.rect,color=None,fill=(0.1,0.3,0.7) if i==0 else (0.6,0.2,0.1))
    page.insert_text((20,50), 'Front ${variant}' if i==0 else 'Back ${variant}',color=(1,1,1))
    if i==1: page.set_rotation(90)
sys.stdout.buffer.write(doc.tobytes(${encrypted?`encryption=pymupdf.PDF_ENCRYPT_AES_256,owner_pw='owner',user_pw='${blankPassword?'':'secret'}'`:''}))
`],{maxBuffer:8*1024*1024});
  if(r.status!==0)throw Error(r.stderr.toString());return r.stdout;
}
