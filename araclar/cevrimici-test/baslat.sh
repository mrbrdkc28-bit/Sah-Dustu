#!/bin/bash
cd "$(dirname "$0")"
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"; export PATH="$JAVA_HOME/bin:$PATH"
nohup firebase emulators:start --only auth,firestore --project demo-chess64 > emu.log 2>&1 &
nohup node sunucu.mjs > sunucu.log 2>&1 &
for i in $(seq 1 40); do grep -q "All emulators ready" emu.log 2>/dev/null && break; sleep 1; done
P=$(cat sifre.txt)
for u in oyuncua oyuncub; do curl -s -X POST "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo" -H "Content-Type: application/json" -d "{\"email\":\"$u@test.local\",\"password\":\"$P\"}" >/dev/null; done
C="/c/Program Files/Google/Chrome/Application/chrome.exe"
for k in 1 2; do rm -rf profil$k; nohup "$C" --headless=new --remote-debugging-port=930$k --user-data-dir="$(pwd)/profil$k" --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=392,872 --force-device-scale-factor=2 "http://127.0.0.1:8765/index.html" > chrome$k.log 2>&1 & done
sleep 12
for k in 1 2; do [ $k = 1 ] && u=oyuncua || u=oyuncub; node cdp.mjs 930$k "(async()=>{ await fbAuth.signInWithEmailAndPassword('$u@test.local','$P'); for(let i=0;i<30&&!fbKullanici;i++) await new Promise(r=>setTimeout(r,200)); await new Promise(r=>setTimeout(r,2500)); document.getElementById('acilisPerde').classList.add('bitti'); return !!fbKullanici })()" | sed "s/$P/***/g"; done
