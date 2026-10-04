// Yerel test sunucusu: assets klasörünü yayınlar; index.html'e emülatör bağlantısı ekler.
import http from 'http'; import fs from 'fs'; import path from 'path';
const KOK='C:/Users/Emre/Desktop/SahDustu/app/src/main/assets';
const TIP={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.woff2':'font/woff2','.mp3':'audio/mpeg','.wasm':'application/wasm','.ogg':'audio/ogg','.wav':'audio/wav'};
http.createServer((q,r)=>{
  let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/') u='/index.html';
  const f=path.join(KOK,u); if(!f.startsWith(path.normalize(KOK))){r.writeHead(403);return r.end();}
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();}
    if(u==='/index.html'){ let s=d.toString('utf8');
      s=s.replace('"projectId": "chess64-c6ff1"','"projectId": "demo-chess64"');
      s=s.replace("fbDb=firebase.firestore();","fbDb=firebase.firestore(); fbAuth.useEmulator('http://127.0.0.1:9099'); fbDb.useEmulator('127.0.0.1',8080);");
      d=Buffer.from(s,'utf8'); }
    r.writeHead(200,{'Content-Type':TIP[path.extname(f)]||'application/octet-stream'}); r.end(d); });
}).listen(8765,'127.0.0.1',()=>console.log('sunucu 8765'));
