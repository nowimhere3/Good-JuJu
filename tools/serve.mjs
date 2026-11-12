import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fork} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon'};
export function createVortexServer({root=process.cwd(),staticOnly=false}={}){
  root=path.resolve(root);const token=randomBytes(32).toString('hex');let job={state:'idle'},worker;
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const server=http.createServer(async(req,res)=>{
    const allowedHosts=[`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`];
    if(!allowedHosts.includes(req.headers.host)){json(res,403,{error:'Local host required.'});return;}
    try{
      const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(name.startsWith('/api/')){
        if(staticOnly){json(res,404,{error:'Scanning is available only with the local application server.'});return;}
        const origin=`http://${req.headers.host}`;
        if(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])||req.headers.origin&&req.headers.origin!==origin){json(res,403,{error:'Same-origin requests required.'});return;}
        if(name==='/api/decks/capabilities'&&req.method==='GET'){json(res,200,{scan:true,token});return;}
        if(req.headers['x-vortex-scan']!==token){json(res,403,{error:'Valid local scan token required.'});return;}
        if(name==='/api/decks/scan'&&req.method==='GET'){json(res,200,job);return;}
        if(name==='/api/decks/scan'&&req.method==='POST'){
          if(req.headers.origin!==origin||req.headers['content-type']!=='application/json'){json(res,403,{error:'Same-origin JSON request required.'});return;}
          let body='';for await(const chunk of req){body+=chunk;if(body.length>1024){json(res,400,{error:'Scan requests do not accept paths or options.'});return;}}
          if(body.trim()!=='{}'){json(res,400,{error:'Scan requests do not accept paths or options.'});return;}
          if(worker||job.state==='running'){json(res,409,{error:'A scan is already running.'});return;}
          job={state:'running',message:'Scanning decks...'};
          worker=fork(fileURLToPath(new URL('./scan-worker.mjs',import.meta.url)),[],{cwd:root,stdio:['ignore','ignore','pipe','ipc']});
          let stderr='';worker.stderr.on('data',b=>{stderr=(stderr+b).slice(-2000);});
          worker.on('message',m=>{if(m.type==='progress')job={state:'running',message:m.message};else if(m.type==='complete')job={state:'complete',...m};else if(m.type==='error')job={state:'error',message:m.message};});
          worker.on('error',e=>{job={state:'error',message:e.message};});
          worker.on('exit',code=>{if(job.state==='running')job={state:'error',message:stderr||`Indexer exited before completing (code ${code}).`};worker=null;});
          json(res,202,job);return;
        }
        json(res,405,{error:'Unsupported scan request.'});return;
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const file=path.resolve(root,'.'+name,name.endsWith('/')?'index.html':'');
      if(!file.startsWith(root+path.sep)||!(await stat(file)).isFile())throw Error('Not found');
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:await readFile(file));
    }catch{if(!res.headersSent){res.writeHead(404);res.end('Not found');}}
  });
  server.on('close',()=>worker?.kill());return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){createVortexServer({root:process.env.SERVE_DIST?'dist':'.',staticOnly:!!process.env.SERVE_DIST}).listen(4173,'127.0.0.1',()=>console.log('Into the VORTEX: http://127.0.0.1:4173'));}
