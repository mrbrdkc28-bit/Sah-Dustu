/* Çevrimiçi ekranı tek sayfa (Kasım 2026, sahibin isteği): süre açılır-kapanır tek satır, ordu/arena sekmeli,
   lobi kartları sıkı. Bu dosya index.html'e gömülür (araclar/cv-tek-sayfa-yama.py); telefonda canlı denemek için de kullanılır. */
(function(){
  const ic=document.getElementById('cevrimiciIcerik'); if(!ic || document.getElementById('cvSureAc')) return;
  const c=t=>(typeof metniCevir==='function')?metniCevir(t):t;
  // --- Süre: tek satır, basınca açılır ---
  const sb=document.getElementById('cvSureBlok');
  const ac=document.createElement('button'); ac.type='button'; ac.id='cvSureAc';
  sb.classList.add('kapali');
  sb.insertBefore(ac, document.getElementById('cvSureler'));
  function sureYaz(){
    const s=sb.querySelector('.cvSure.secili');
    const ad=s ? (s.dataset.dk==='0' ? '∞ '+c('Süresiz') : s.childNodes[0].textContent.trim()+' · '+(s.querySelector('small')||{}).textContent) : '';
    ac.innerHTML='<span class="csEt">'+c('SÜRE')+'</span><b>'+ad+'</b><i>'+(sb.classList.contains('kapali')?'▾':'▴')+'</i>';
  }
  ac.onclick=()=>{ sb.classList.toggle('kapali'); sureYaz(); };
  sb.querySelectorAll('.cvSure').forEach(b=>b.addEventListener('click',()=>{ setTimeout(()=>{ sb.classList.add('kapali'); sureYaz(); },0); }));
  sureYaz();
  window.cvSureYaz=sureYaz;
  // --- Ordu / Arena: sekmeli tek satır ---
  const ob=document.getElementById('cvOrduBlok'), ab=document.getElementById('cvArenaBlok');
  const sek=document.createElement('div'); sek.id='cvSecimSekme';
  sek.innerHTML='<button type="button" data-s="ordu" class="secili"></button><button type="button" data-s="arena"></button>';
  ic.insertBefore(sek, ob);
  ic.classList.add('sekmeOrdu');
  function sekmeYaz(){
    const so=(typeof aktifOrdu!=='undefined'&&aktifOrdu)?aktifOrdu.ad:'', sa=(typeof aktifArena!=='undefined'&&aktifArena)?aktifArena.ad:'';
    const [b1,b2]=sek.querySelectorAll('button');
    b1.innerHTML='<span>'+c('ORDUN')+'</span><b>'+c(so)+'</b>'; b2.innerHTML='<span>'+c('ARENA')+'</span><b>'+c(sa)+'</b>';
  }
  sek.onclick=e=>{
    const b=e.target.closest('button'); if(!b) return;
    sek.querySelectorAll('button').forEach(x=>x.classList.toggle('secili', x===b));
    ic.classList.toggle('sekmeOrdu', b.dataset.s==='ordu'); ic.classList.toggle('sekmeArena', b.dataset.s==='arena');
  };
  [ob,ab].forEach(bl=>bl.addEventListener('click',()=>setTimeout(sekmeYaz,50)));
  sekmeYaz();
  // --- Kartların altında tek satır: taş sesi paketleri (dokun: seç ve dinle) + yazısız ayar düğmesi ---
  const PK=['klasik','ahsap','ordu','gercek','savas','destan'], PAD={klasik:'Klasik',ahsap:'Ahşap',ordu:'Ordu',gercek:'Gerçek',savas:'Savaş',destan:'Destan'};
  const satir=document.createElement('div'); satir.id='cvSesSatir';
  ic.appendChild(satir);
  function sesCiz(){
    const ts=(typeof Ses!=='undefined' && Ses.tasSesAyar) ? Ses.tasSesAyar : {paket:'klasik',ozel:{}};
    satir.innerHTML='<button type="button" class="cvSesEt" aria-label="'+c('Taş sesleri')+'"><span>♪</span>'+c('Taş sesleri')+'</button>'+
      '<div class="cvSesCipler">'+PK.map(k=>'<button type="button" data-pk="'+k+'" class="'+(ts.paket===k?'secili':'')+'">'+c(PAD[k])+'</button>').join('')+'</div>'+
      '<button type="button" class="cvAyarDugme" aria-label="'+c('Ayarlar')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>';
  }
  satir.onclick=e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.classList.contains('cvAyarDugme')){ if(window.oyunAyarlariAc) window.oyunAyarlariAc(); return; }
    if(b.classList.contains('cvSesEt')){ if(window.oyunAyarlariAc) window.oyunAyarlariAc(); setTimeout(()=>{ if(window.tasSesleriAc) window.tasSesleriAc(); },60); return; }   // taş taş ayar
    const pk=b.dataset.pk; if(!pk || typeof Ses==='undefined') return;
    Ses.tasSesPaket(pk); try{ Ses.dinle('n','hamle',pk); }catch(x){}
    const sx=satir.querySelector('.cvSesCipler').scrollLeft; sesCiz(); satir.querySelector('.cvSesCipler').scrollLeft=sx;
  };
  sesCiz();
  window.cvSekmeYaz=()=>{ sekmeYaz(); sesCiz(); };
})();
