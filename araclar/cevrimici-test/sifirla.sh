#!/bin/bash
cd "$(dirname "$0")"
for k in 9301 9302; do node cdp.mjs $k "(async()=>{ try{ await Cevrimici.ayril(); }catch(e){} location.reload(); return 1 })()" >/dev/null 2>&1; done
sleep 9
curl -s -X DELETE "http://127.0.0.1:8080/emulator/v1/projects/demo-chess64/databases/(default)/documents" >/dev/null
for k in 9301 9302; do node cdp.mjs $k "(async()=>{ for(let i=0;i<20&&!fbKullanici;i++) await new Promise(r=>setTimeout(r,300)); document.getElementById('acilisPerde').classList.add('bitti'); return !!fbKullanici })()"; done
