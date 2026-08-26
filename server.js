const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 10000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const USER_INDEX = path.join(PUBLIC_DIR, 'index.html');
const ADMIN_INDEX = path.join(PUBLIC_DIR, 'admin', 'index.html');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'applications.json');

const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2' };

function ensureDb(){
  fs.mkdirSync(DATA_DIR,{recursive:true});
  if(!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE,'[]','utf8');
}
function readDb(){ ensureDb(); try { const data=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); return Array.isArray(data)?data:[]; } catch { return []; } }
function writeDb(rows){ ensureDb(); const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(rows,null,2),'utf8'); fs.renameSync(tmp,DB_FILE); }
function sendJson(res,status,data){ res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(data)); }
function body(req){ return new Promise((resolve,reject)=>{let raw=''; req.on('data',c=>{raw+=c;if(raw.length>1000000) req.destroy();}); req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(e){reject(e);}});req.on('error',reject);}); }
function safePath(base,requestPath){ const clean=requestPath.split('?')[0]||'/'; let decoded; try{decoded=decodeURIComponent(clean);}catch{return null;} const root=path.resolve(base); const target=path.resolve(root,'.'+decoded); return target===root||target.startsWith(root+path.sep)?target:null; }
function sendFile(req,res,file){ fs.stat(file,(err,stat)=>{ if(err||!stat.isFile()){res.writeHead(err?.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'});return res.end(err?.code==='ENOENT'?'Not found':'Server error');} res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-cache, no-store, must-revalidate'}); if(req.method==='HEAD')return res.end(); fs.createReadStream(file).pipe(res); }); }

ensureDb();

const server=http.createServer(async(req,res)=>{
  const raw=req.url||'/';
  let url; try{url=decodeURIComponent(raw.split('?')[0]||'/');}catch{res.writeHead(400);return res.end('Bad request');}
  const normalized=url.replace(/\/{2,}/g,'/');

  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
  if(normalized==='/health') return sendJson(res,200,{ok:true,database:'local',user:'/',admin:'/farabi@/'});

  // Local database API. No Supabase or external database is used.
  if(normalized==='/api/applications' && req.method==='GET') return sendJson(res,200,readDb().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
  if(normalized==='/api/applications' && req.method==='POST'){
    try{
      const b=await body(req);
      const full_name=String(b.full_name||b.name||'').trim(), phone=String(b.phone||'').trim(), course=String(b.course||'').trim();
      if(!full_name||!phone||!course) return sendJson(res,400,{error:'full_name, phone and course are required'});
      const app={id:'FITC-'+crypto.randomBytes(4).toString('hex').toUpperCase(),token:'FITC-'+crypto.randomBytes(3).toString('hex').toUpperCase(),full_name,phone,email:b.email?String(b.email).trim():null,course,message:b.message?String(b.message).trim():null,status:b.status||'new',created_at:new Date().toISOString()};
      const rows=readDb(); rows.unshift(app); writeDb(rows); return sendJson(res,201,app);
    }catch(e){return sendJson(res,400,{error:'Invalid JSON'});}
  }
  if(normalized.startsWith('/api/applications/') && req.method==='DELETE'){
    const id=normalized.slice('/api/applications/'.length); const rows=readDb(); const next=rows.filter(a=>a.id!==id&&a.phone!==id); if(next.length===rows.length)return sendJson(res,404,{error:'Application not found'}); writeDb(next); return sendJson(res,200,{ok:true});
  }

  if(normalized==='/farabi@' || normalized==='/farabi@/') return sendFile(req,res,ADMIN_INDEX);
  if(normalized.startsWith('/farabi@/')){ const relative=normalized.slice('/farabi@'.length)||'/'; const file=safePath(path.join(PUBLIC_DIR,'admin'),relative); if(!file){res.writeHead(403);return res.end('Forbidden');} return sendFile(req,res,file); }

  const file=safePath(PUBLIC_DIR,normalized); if(!file){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{ if(!err&&stat.isFile())return sendFile(req,res,file); return sendFile(req,res,USER_INDEX); });
});
server.on('error',e=>{console.error(e);process.exit(1);});
server.listen(PORT,'0.0.0.0',()=>console.log(`Farabi server on ${PORT} | local DB: ${DB_FILE}`));
