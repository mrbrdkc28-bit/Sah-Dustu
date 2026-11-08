/* Ana sayfa tek ekran (Kasım 2026, sahibin isteği). index.html'e gömülür; telefonda canlı denemek için de kullanılır. */
(function(){
  if(window._menuTekSayfa) return; window._menuTekSayfa=1;
  const c=t=>(typeof metniCevir==='function')?metniCevir(t):t;
  const menu=document.getElementById('menu'), cubuk=document.getElementById('profilCubuk'), kartlar=menu&&menu.querySelector('.kartlar');
  if(!menu || !cubuk || !kartlar) return;
  kartlar.parentNode.insertBefore(cubuk, kartlar);      // kullanıcı kartı başlığın altında, kartların üstünde
  /* Giriş yapılmışsa: fotoğraf + ad + puan, dokununca Profilim. Çıkış Profilim ekranının başlığında. */
  const eski=window.girisDurumGuncelle;
  function kartYaz(){
    if(!(typeof fbKullanici!=='undefined' && fbKullanici && !misafirMod)) return;
    const ad=(bulutIst && bulutIst.kullaniciAdi) || (fbKullanici.email ? fbKullanici.email.split('@')[0] : 'Oyuncu');
    const av=(typeof avatarMiniHtml==='function') ? avatarMiniHtml(40) : ((bulutIst&&bulutIst.avatar)||'♞');
    cubuk.innerHTML='<span class="pkAv">'+av+'</span><span class="pkMetin"><span class="pkAd" data-cevirme>'+lobiKac(ad)+'</span>'+
      '<span class="pkAlt"><span>'+c((bulutIst.puan||800)+' puan')+'</span> · <span>'+c('Profilim')+'</span></span></span><span class="pkOk">›</span>';
    cubuk.onclick=()=>{ if(typeof istEkraniAc==='function') istEkraniAc(); };
  }
  if(typeof eski==='function'){
    window.girisDurumGuncelle=function(){ const r=eski.apply(this,arguments); try{ kartYaz(); }catch(e){} return r; };
    try{ girisDurumGuncelle=window.girisDurumGuncelle; }catch(e){}
  }
  try{ kartYaz(); }catch(e){}
  /* Profilim başlığına Çıkış */
  const ib=document.getElementById('istBaslik');
  if(ib && !document.getElementById('istCikis')){
    const b=document.createElement('button'); b.type='button'; b.id='istCikis'; b.textContent=c('Çıkış');
    b.onclick=()=>{ if(typeof cikisYap==='function') cikisYap(); };
    ib.appendChild(b);
  }
})();

/* Tarayıcıya QR ile giriş: Profilim başlığındaki düğme kamerayı açar, okutulan kod onaylanınca tarayıcıda oturum açılır */
(function(){
  const c=t=>(typeof metniCevir==='function')?metniCevir(t):t;
  const and=(typeof AndroidBildirim!=='undefined' && AndroidBildirim.qrTara), ios=!!(window.IOS_UYGULAMA && window.webkit && webkit.messageHandlers && webkit.messageHandlers.ios);
  const ib=document.getElementById('istBaslik'), cik=document.getElementById('istCikis');
  if(!(and||ios) || !ib || document.getElementById('istQr')) return;
  const b=document.createElement('button'); b.type='button'; b.id='istQr';
  b.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M21 21h-4v-4M14 21v-.01"/></svg><span>'+c('Tarayıcı')+'</span>';
  b.onclick=()=>{
    if(!fbKullanici || misafirMod){ anlatimGoster(c('Önce hesabınla giriş yap.'),3000); return; }
    /* Oyuncu adresi buradan öğrenir: önce nereye gireceği söylenir, sonra kamera açılır */
    const p=document.createElement('div'); p.id='retPop';
    p.style.cssText='position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,5,9,.72)';
    p.innerHTML='<div style="width:min(340px,92vw);background:linear-gradient(180deg,#171a24,#0d0f15);border:1px solid rgba(232,182,76,.35);border-radius:20px;padding:22px 18px 16px;text-align:center"><div style="font:700 17px Cinzel,serif;color:#E8B64C;margin-bottom:10px"></div><div style="color:#cfc8b8;font-size:14px;line-height:1.5"></div><div data-cevirme style="font:800 19px Manrope,sans-serif;color:#F2C765;margin:10px 0 16px">playchess64.pages.dev</div><div style="display:flex;gap:8px"><button type="button" style="flex:1;padding:11px;border-radius:12px;border:none;background:#E8B64C;color:#1a1408;font-weight:700"></button><button type="button" style="flex:1;padding:11px;border-radius:12px;border:1px solid rgba(232,182,76,.4);background:transparent;color:#E8B64C;font-weight:700"></button></div></div>';
    const d=p.firstChild, btn=d.querySelectorAll('button');
    d.children[0].textContent=c('Bilgisayarda oyna');
    d.children[1].textContent=c('Bilgisayarında bu adresi aç, ekranda çıkan kodu okut.');
    btn[0].textContent=c('Kodu okut'); btn[1].textContent=c('Vazgeç');
    btn[1].onclick=()=>p.remove();
    btn[0].onclick=()=>{ p.remove(); if(and) AndroidBildirim.qrTara(); else webkit.messageHandlers.ios.postMessage({ad:'qrTara',deger:''}); };
    document.body.appendChild(p);
  };
  ib.insertBefore(b, cik||null);
  async function onayla(id){
    try{
      const t=await fbKullanici.getIdToken();
      const r=await fetch('https://europe-west1-chess64-c6ff1.cloudfunctions.net/qrOnayla',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({data:{id}})});
      const j=await r.json();
      anlatimGoster(c(j.result&&j.result.tamam?'Tarayıcıda giriş yapıldı.':'Kodun süresi dolmuş, tarayıcıdaki yeni kodu okut.'),3500);
    }catch(e){ anlatimGoster(c('Bağlantı kurulamadı, yeniden dene.'),3500); }
  }
  window.qrTarandi=function(m){
    const k=/^c64qr:([0-9a-f]{32})$/.exec(String(m||''));
    if(!k){ anlatimGoster(c('Bu bir Chess64 giriş kodu değil.'),3500); return; }
    const p=document.createElement('div'); p.id='retPop';
    p.style.cssText='position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,5,9,.72)';
    p.innerHTML='<div style="width:min(340px,92vw);background:linear-gradient(180deg,#171a24,#0d0f15);border:1px solid rgba(232,182,76,.35);border-radius:20px;padding:22px 18px 16px;text-align:center"><div style="font:700 17px Cinzel,serif;color:#E8B64C;margin-bottom:10px"></div><div style="color:#cfc8b8;font-size:14px;line-height:1.5;margin-bottom:16px"></div><div style="display:flex;gap:8px"><button type="button" style="flex:1;padding:11px;border-radius:12px;border:none;background:#E8B64C;color:#1a1408;font-weight:700"></button><button type="button" style="flex:1;padding:11px;border-radius:12px;border:1px solid rgba(232,182,76,.4);background:transparent;color:#E8B64C;font-weight:700"></button></div></div>';
    const d=p.firstChild, btn=d.querySelectorAll('button');
    d.children[0].textContent=c('Tarayıcıda giriş yapılsın mı?');
    d.children[1].textContent=c('Hesabın bu kodu gösteren tarayıcıda açılacak. Yalnız kendi ekranındaki kodu onayla.');
    btn[0].textContent=c('Onayla'); btn[1].textContent=c('Vazgeç');
    btn[0].onclick=()=>{ p.remove(); onayla(k[1]); }; btn[1].onclick=()=>p.remove();
    document.body.appendChild(p);
  };
})();
