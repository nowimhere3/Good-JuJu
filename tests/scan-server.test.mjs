import {test} from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,copyFile,writeFile,readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createVortexServer} from '../tools/serve.mjs';
import {indexDecks} from '../tools/index-decks.mjs';
test('local scanner validates origin, host, token, body, busy state and static unavailability',async()=>{
  await mkdir('tmp',{recursive:true});const root=await mkdtemp(path.resolve('tmp/scan-api-'));await mkdir(path.join(root,'All Decks/Pair'),{recursive:true});
  await copyFile('assets/cards/r1/f1.jpg',path.join(root,'All Decks/Pair/F1.jpg'));await copyFile('assets/cards/r1/b1.jpg',path.join(root,'All Decks/Pair/B1.jpg'));
  const server=createVortexServer({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
  const request=(suffix,options)=>fetch(url+suffix,options);const endpoint='/api/decks/scan';
  try{
    const cap=await(await request('/api/decks/capabilities')).json();
    const headers={'Content-Type':'application/json','X-Vortex-Scan':cap.token,Origin:url};
    const rawStatus=headers=>new Promise((resolve,reject)=>{const req=http.get(url+'/api/decks/capabilities',{headers},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
    assert.equal(await rawStatus({Host:'evil.example'}),403);
    assert.equal(await rawStatus({'Sec-Fetch-Site':'cross-site'}),403);
    assert.equal((await request(endpoint,{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
    assert.equal((await request(endpoint,{method:'POST',headers:{...headers,'X-Vortex-Scan':'bad'},body:'{}'})).status,403);
    assert.equal((await request(endpoint,{method:'POST',headers,body:'{"path":"C:/"}'})).status,400);
    assert.equal((await request(endpoint,{method:'POST',headers,body:'{}'})).status,202);
    assert.equal((await request(endpoint,{method:'POST',headers,body:'{}'})).status,409);
    let job;for(let i=0;i<100;i++){job=await(await request(endpoint,{headers:{'X-Vortex-Scan':cap.token}})).json();if(job.state!=='running')break;await new Promise(r=>setTimeout(r,50));}
    assert.equal(job.state,'complete');assert.equal(job.cards,1);assert.equal(job.newDecks,1);
  }finally{await new Promise(r=>server.close(r));}
  const staticServer=createVortexServer({root,staticOnly:true});await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));
  try{assert.equal((await fetch(`http://127.0.0.1:${staticServer.address().port}/api/decks/capabilities`)).status,404);}finally{await new Promise(r=>staticServer.close(r));}
});
test('validation failure preserves catalog, existing manifests and does not create pending manifests',async()=>{
  await mkdir('tmp',{recursive:true});const root=await mkdtemp(path.resolve('tmp/scan-invalid-'));const deck=path.join(root,'All Decks/Good');await mkdir(deck,{recursive:true});await copyFile('assets/cards/r1/f1.jpg',path.join(deck,'F1.jpg'));await copyFile('assets/cards/r1/b1.jpg',path.join(deck,'B1.jpg'));await indexDecks(root);
  const catalog=await readFile(path.join(root,'data/cards.json'),'utf8'),manifest=await readFile(path.join(deck,'deck.json'),'utf8');const bad=path.join(root,'All Decks/Invalid');await mkdir(bad);await writeFile(path.join(bad,'Broken.pdf'),'bad');
  await assert.rejects(()=>indexDecks(root),/Broken.pdf/);assert.equal(await readFile(path.join(root,'data/cards.json'),'utf8'),catalog);assert.equal(await readFile(path.join(deck,'deck.json'),'utf8'),manifest);await assert.rejects(()=>access(path.join(bad,'deck.json')));
});
