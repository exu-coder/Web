const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const USER_INDEX = path.join(PUBLIC_DIR, 'index.html');
const ADMIN_INDEX = path.join(PUBLIC_DIR, 'admin', 'index.html');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'farabi_it_center';

let mongoClient;
let mongoDb;
let mongoPromise;

async function getDb() {
  if (mongoDb) return mongoDb;
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  if (!mongoPromise) {
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    });
    mongoPromise = mongoClient.connect().then(client => {
      mongoDb = client.db(MONGODB_DATABASE);
      return mongoDb;
    }).catch(err => {
      mongoPromise = null;
      throw err;
    });
  }
  return mongoPromise;
}

async function applicationsCollection() {
  const db = await getDb();
  return db.collection('applications');
}

const MIME = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'
};

function sendJson(res,status,data){
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'Access-Control-Allow-Origin':'*'
  });
  res.end(JSON.stringify(data));
}

function body(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',c=>{
      raw+=c;
      if(raw.length>1000000) req.destroy();
    });
    req.on('end',()=>{
      try{resolve(raw?JSON.parse(raw):{});}catch(e){reject(e);}
    });
    req.on('error',reject);
  });
}

function safePath(base,requestPath){
  const clean=requestPath.split('?')[0]||'/';
  let decoded;
  try{decoded=decodeURIComponent(clean);}catch{return null;}
  const root=path.resolve(base);
  const target=path.resolve(root,'.'+decoded);
  return target===root||target.startsWith(root+path.sep)?target:null;
}

function sendFile(req,res,file){
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()){
      res.writeHead(err?.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'});
      return res.end(err?.code==='ENOENT'?'Not found':'Server error');
    }
    res.writeHead(200,{
      'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream',
      'Cache-Control':'no-cache, no-store, must-revalidate'
    });
    if(req.method==='HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

async function initMongo(){
  const collection = await applicationsCollection();
  await collection.createIndex({created_at:-1});
  await collection.createIndex({id:1},{unique:true});
  console.log(`MongoDB connected: ${MONGODB_DATABASE}`);
}

const server=http.createServer(async(req,res)=>{
  const raw=req.url||'/';
  let url;
  try{url=decodeURIComponent(raw.split('?')[0]||'/');}catch{res.writeHead(400);return res.end('Bad request');}
  const normalized=url.replace(/\/{2,}/g,'/');

  if(req.method==='OPTIONS'){
    res.writeHead(204,{
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type, Authorization'
    });
    return res.end();
  }

  if(normalized==='/health'){
    try{
      await getDb();
      return sendJson(res,200,{ok:true,database:'mongodb',database_name:MONGODB_DATABASE,user:'/',admin:'/farabi@/'});
    }catch(error){
      console.error('MongoDB health check failed:',error.message);
      return sendJson(res,503,{ok:false,database:'mongodb',error:'Database unavailable'});
    }
  }

  if(normalized==='/api/applications' && req.method==='GET'){
    try{
      const collection=await applicationsCollection();
      const rows=await collection.find({}).sort({created_at:-1}).toArray();
      return sendJson(res,200,rows);
    }catch(error){
      console.error('MongoDB read failed:',error);
      return sendJson(res,503,{error:'Database unavailable'});
    }
  }

  if(normalized==='/api/applications' && req.method==='POST'){
    try{
      const b=await body(req);
      const full_name=String(b.full_name||b.name||'').trim();
      const phone=String(b.phone||'').trim();
      const course=String(b.course||'').trim();
      if(!full_name||!phone||!course) return sendJson(res,400,{error:'full_name, phone and course are required'});

      const app={
        id:'FITC-'+crypto.randomBytes(4).toString('hex').toUpperCase(),
        token:'FITC-'+crypto.randomBytes(3).toString('hex').toUpperCase(),
        full_name,
        phone,
        email:b.email?String(b.email).trim():null,
        course,
        message:b.message?String(b.message).trim():null,
        status:'new',
        created_at:new Date().toISOString()
      };

      const collection=await applicationsCollection();
      await collection.insertOne(app);
      return sendJson(res,201,app);
    }catch(error){
      console.error('MongoDB insert failed:',error);
      return sendJson(res,503,{error:'Database unavailable'});
    }
  }

  if(normalized.startsWith('/api/applications/') && req.method==='DELETE'){
    try{
      const id=normalized.slice('/api/applications/'.length);
      const collection=await applicationsCollection();
      const result=await collection.deleteOne({$or:[{id},{phone:id}]});
      if(!result.deletedCount) return sendJson(res,404,{error:'Application not found'});
      return sendJson(res,200,{ok:true});
    }catch(error){
      console.error('MongoDB delete failed:',error);
      return sendJson(res,503,{error:'Database unavailable'});
    }
  }

  if(normalized==='/farabi@' || normalized==='/farabi@/') return sendFile(req,res,ADMIN_INDEX);
  if(normalized.startsWith('/farabi@/')){
    const relative=normalized.slice('/farabi@'.length)||'/';
    const file=safePath(path.join(PUBLIC_DIR,'admin'),relative);
    if(!file){res.writeHead(403);return res.end('Forbidden');}
    return sendFile(req,res,file);
  }

  const file=safePath(PUBLIC_DIR,normalized);
  if(!file){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{
    if(!err&&stat.isFile())return sendFile(req,res,file);
    return sendFile(req,res,USER_INDEX);
  });
});

server.on('error',e=>{console.error(e);process.exit(1);});

(async()=>{
  try{
    await initMongo();
    server.listen(PORT,'0.0.0.0',()=>console.log(`Farabi server on ${PORT} | MongoDB: ${MONGODB_DATABASE}`));
  }catch(error){
    console.error('Startup failed:',error.message);
    process.exit(1);
  }
})();
