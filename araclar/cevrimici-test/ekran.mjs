// node ekran.mjs <port> <dosya.png>
import fs from 'fs';
const port=process.argv[2];
const liste=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const s=liste.find(p=>p.type==='page'&&p.url.includes('8765'))||liste.find(p=>p.type==='page');
const ws=new WebSocket(s.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id===1){ fs.writeFileSync(process.argv[3], Buffer.from(m.result.data,'base64')); process.exit(0);} };
ws.send(JSON.stringify({id:1,method:'Page.captureScreenshot',params:{format:'png'}}));
