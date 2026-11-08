/* Oyun Kur ekranı tek sayfa (Kasım 2026, sahibin isteği; çevrimiçi ekranla aynı dil): mod/zorluk/renk sıkı satırlar,
   süre açılır-kapanır tek satır, ordu/arena sekmeli tek kart satırı, altta taş sesi paketleri + yazısız ayar düğmesi. */
(function(){
  const ic=document.getElementById('kurulumIcerik'); if(!ic || document.getElementById('kurSureAc')) return;
  const c=t=>(typeof metniCevir==='function')?metniCevir(t):t;
  const blok=id=>{ const e=document.getElementById(id); return e && e.closest('.blok'); };
  const arenaB=blok('arenaListe'), orduB=blok('orduListe'), sureB=blok('sureler');
  if(!arenaB || !orduB || !sureB) return;
  arenaB.id='kurArenaBlok'; orduB.id='kurOrduBlok'; sureB.id='kurSureBlok';
  ic.classList.add('kurTek');
  // --- Süre: tek satır, basınca açılır ---
  const ac=document.createElement('button'); ac.type='button'; ac.id='kurSureAc';
  sureB.classList.add('kapali');
  sureB.insertBefore(ac, document.getElementById('sureler'));
  function sureYaz(){
    const s=sureB.querySelector('#sureler .mod.secili');
    let ad=s ? s.textContent.trim() : '';
    const tur={60:'Bullet',180:'Blitz',300:'Blitz',600:'Rapid',900:'Rapid'}[s && s.dataset.sure];
    if(tur) ad+=' · '+tur;
    ac.innerHTML='<span class="csEt">'+c('SÜRE')+'</span><b>'+c(ad)+'</b><i>'+(sureB.classList.contains('kapali')?'▾':'▴')+'</i>';
  }
  ac.onclick=()=>{ sureB.classList.toggle('kapali'); sureYaz(); };
  sureB.querySelectorAll('#sureler .mod').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{ sureB.classList.add('kapali'); sureYaz(); },0)));
  sureYaz();
  // Süre ordu/arenanın üstüne (çevrimiçi ekrandaki sıra)
  ic.insertBefore(sureB, orduB.compareDocumentPosition(arenaB)&Node.DOCUMENT_POSITION_FOLLOWING ? orduB : arenaB);
  // --- Ordu / Arena sekmeleri ---
  const sek=document.createElement('div'); sek.id='kurSecimSekme';
  sek.innerHTML='<button type="button" data-s="ordu" class="secili"></button><button type="button" data-s="arena"></button>';
  ic.insertBefore(sek, sureB.nextSibling);
  ic.insertBefore(orduB, sek.nextSibling); ic.insertBefore(arenaB, orduB.nextSibling);
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
  [orduB,arenaB].forEach(bl=>bl.addEventListener('click',()=>setTimeout(sekmeYaz,50)));
  sekmeYaz();
  // --- Taş sesleri + ayar düğmesi (çevrimiçi ekrandakiyle aynı) ---
  const PK=['klasik','ahsap','ordu','gercek','savas','destan'], PAD={klasik:'Klasik',ahsap:'Ahşap',ordu:'Ordu',gercek:'Gerçek',savas:'Savaş',destan:'Destan'};
  const satir=document.createElement('div'); satir.id='kurSesSatir'; satir.className='sesSatir';
  ic.insertBefore(satir, arenaB.nextSibling);
  function sesCiz(){
    const ts=(typeof Ses!=='undefined' && Ses.tasSesAyar) ? Ses.tasSesAyar : {paket:'klasik',ozel:{}};
    satir.innerHTML='<button type="button" class="cvSesEt" aria-label="'+c('Taş sesleri')+'"><span>♪</span>'+c('Taş sesleri')+'</button>'+
      '<div class="cvSesCipler">'+PK.map(k=>'<button type="button" data-pk="'+k+'" class="'+(ts.paket===k?'secili':'')+'">'+c(PAD[k])+'</button>').join('')+'</div>'+
      '<button type="button" class="cvAyarDugme" aria-label="'+c('Ayarlar')+'">'+((document.querySelector('#cvSesSatir .cvAyarDugme')||{}).innerHTML||'⚙')+'</button>';
  }
  satir.onclick=e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.classList.contains('cvAyarDugme')){ if(window.oyunAyarlariAc) window.oyunAyarlariAc(); return; }
    if(b.classList.contains('cvSesEt')){ if(window.oyunAyarlariAc) window.oyunAyarlariAc(); setTimeout(()=>{ if(window.tasSesleriAc) window.tasSesleriAc(); },60); return; }
    const pk=b.dataset.pk; if(!pk || typeof Ses==='undefined') return;
    Ses.tasSesPaket(pk); try{ Ses.dinle('n','hamle',pk); }catch(x){}
    const sx=satir.querySelector('.cvSesCipler').scrollLeft; sesCiz(); satir.querySelector('.cvSesCipler').scrollLeft=sx;
  };
  sesCiz();
  window.kurTekYaz=()=>{ sureYaz(); sekmeYaz(); sesCiz(); };
})();
