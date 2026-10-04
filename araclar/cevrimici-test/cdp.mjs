// node cdp.mjs <port> "<ifade>"  -> o Chrome'daki uygulama sayfasında çalıştırır
const port=process.argv[2];
const liste=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const s=liste.find(p=>p.type==='page'&&p.url.includes('8765'))||liste.find(p=>p.type==='page');
const ws=new WebSocket(s.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id===1){const r=m.result; console.log(r.exceptionDetails?'HATA '+JSON.stringify(r.exceptionDetails).slice(0,400):(typeof r.result.value==='string'?r.result.value:JSON.stringify(r.result.value))); process.exit(0);}};
ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:process.argv[3],awaitPromise:true,returnByValue:true}}));
