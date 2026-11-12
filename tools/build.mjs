import {vendorPdf} from './vendor-pdf.mjs';
import {mkdir,cp} from 'node:fs/promises';
import {indexDecks} from './index-decks.mjs';
await indexDecks(process.cwd());
await vendorPdf();
await mkdir('dist',{recursive:true});
for (const file of ['index.html','app','data','assets']) await cp(file,`dist/${file}`,{recursive:true});
console.log('Private local static package built in dist/ with relative URLs. Nothing published.');
