import {mkdir,cp} from 'node:fs/promises';
// Copy the pinned local distribution, including fonts, CMaps and WASM decoders.
export async function vendorPdf(){
  await mkdir('assets/pdfjs',{recursive:true});
  for(const name of ['pdf.mjs','pdf.worker.mjs'])await cp(`node_modules/pdfjs-dist/build/${name}`,`assets/pdfjs/${name}`);
  for(const name of ['cmaps','standard_fonts','wasm'])await cp(`node_modules/pdfjs-dist/${name}`,`assets/pdfjs/${name}`,{recursive:true});
  await cp('node_modules/pdfjs-dist/LICENSE','assets/pdfjs/LICENSE');
}
