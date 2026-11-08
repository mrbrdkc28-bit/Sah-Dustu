/* Tarayıcıya QR ile giriş (Kasım 2026, sahibin isteği). Yalnız tarayıcı sürümünde yüklenir (araclar/web-hazirla.py).
   Akış: sayfa sunucudan tek kullanımlık kod alır, QR gösterir; telefondaki Chess64 Profilim > Tarayıcı ile okutup onaylar;
   sayfa sunucudan oturum anahtarını alır. Kod 2 dakikada yenilenir. Sunucu: functions/index.js (qrBaslat, qrAl). */
(function(){
  const adres=n=>'https://europe-west1-chess64-c6ff1.cloudfunctions.net/'+n;
  async function cagir(n,data){
    const r=await fetch(adres(n),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:data||{}})});
    const j=await r.json(); if(j.error) throw new Error(j.error.message||'hata'); return j.result;
  }
  const c=t=>(typeof metniCevir==='function')?metniCevir(t):t;
  let oturum=null, zaman=null, calisiyor=false;
  function kutuKur(){
    let k=document.getElementById('webQr'); if(k) return k;
    const alt=document.getElementById('webIndirKutu'); if(!alt) return null;
    k=document.createElement('div'); k.id='webQr';
    k.innerHTML='<div id="webQrKod"></div><div class="wqMetin"><b></b><span></span></div>';
    k.querySelector('b').textContent=c('Telefonla giriş');
    k.querySelector('span').textContent=c('Chess64 uygulamasında Profilim ekranındaki Tarayıcı düğmesine bas ve bu kodu okut.');
    alt.parentNode.insertBefore(k,alt);
    return k;
  }
  const gorunur=()=>{ const g=document.getElementById('girisEkran'); return g && !g.classList.contains('gizli') && !(typeof fbKullanici!=='undefined' && fbKullanici); };
  async function yeni(){
    const yer=document.getElementById('webQrKod'); if(!yer) return;
    try{
      oturum=await cagir('qrBaslat');
      const q=qrcode(0,'M'); q.addData('c64qr:'+oturum.id); q.make();
      yer.innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true});
    }catch(e){ oturum=null; yer.textContent=c('Kod alınamadı'); }
  }
  async function dongu(){
    if(calisiyor) return; calisiyor=true;
    try{
      if(!gorunur()){ oturum=null; return; }
      if(!document.getElementById('webQr') && !kutuKur()) return;
      if(!oturum){ await yeni(); return; }
      const r=await cagir('qrAl',{id:oturum.id,gizli:oturum.gizli});
      if(r.durum==='tamam' && r.token){ oturum=null; await fbAuth.signInWithCustomToken(r.token); }
      else if(r.durum==='bitti'){ await yeni(); }
    }catch(e){}
    finally{ calisiyor=false; }
  }
  zaman=setInterval(dongu,2500); dongu();
})();
