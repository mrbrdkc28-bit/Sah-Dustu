
/* ---- Eğitim görünümü: Bulmaca, Öğren ve Kütüphane'de standart tahta Oyma Tahta, taşlar Çizgi Film (sahibin isteği) ----
   Oyuncunun kendi seçimi saklanır, bölümden çıkınca geri konur. */
let _egitimOnceki=null;
function egitimGorunumAc(){
  if(_egitimOnceki) return;
  _egitimOnceki={o:aktifOrdu, a:aktifArena};
  const o=ORDULAR.find(x=>x.id==='cizgi'), a=ARENALAR.find(x=>x.id==='oymamasa');
  if(o) aktifOrdu=o;
  if(a) aktifArena=a;
}
function egitimGorunumKapat(){
  if(!_egitimOnceki) return;
  const e=_egitimOnceki; _egitimOnceki=null;
  aktifOrdu=e.o; aktifArena=e.a;
  try{ arenaKur(aktifArena); taslariDiz(false); }catch(x){}
}

/* Taş görselleri CSS sınıfı olarak bir kez kurulur (.tk-wK ...): Öğren ve Kütüphane kullanır; iOS'ta set otomatik değişir */
function tasSinifKur(){
  if(document.getElementById('tkStil') || typeof CBURNETT==='undefined') return;
  const st=document.createElement('style'); st.id='tkStil';
  st.textContent=Object.keys(CBURNETT).map(k=>'.tk-'+k+'{background-image:url("data:image/svg+xml;utf8,'+encodeURIComponent(CBURNETT[k])+'")}').join('');
  document.head.appendChild(st);
}
function kutupTahta(fen){
  let h='', sat=0, sut=0;
  for(const ch of fen.split(' ')[0]){
    if(ch==='/'){ sat++; sut=0; continue; }
    if(/\d/.test(ch)){ for(let i=0;i<+ch;i++){ h+='<i class="'+((sat+sut)%2?'k':'a')+'"></i>'; sut++; } continue; }
    const k=(ch===ch.toUpperCase()?'w':'b')+ch.toUpperCase();
    h+='<i class="'+((sat+sut)%2?'k':'a')+' tk-'+k+'"></i>'; sut++;
  }
  return '<div class="kpTahta" aria-hidden="true">'+h+'</div>';
}
const KUTUP_IK_KURAL=['wN','bK','wR','wP','wQ','½','◷','☝','★'];
const KUTUP_IK_VARYANT=['960','wN','wB','wK','3+','✹','bP','wP','⚑'];
function kutupIkon(k){ return /^[wb][PNBRQK]$/.test(k) ? '<span class="kpIk tk tk-'+k+'"></span>' : '<span class="kpIk">'+k+'\uFE0E</span>'; }
function kutupDil(o){ return ((typeof uygDil!=='undefined' && uygDil && uygDil!=='tr') ? o.en : o.tr) || o.tr; }
function kutupKac(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
let kutupSekme='kural';
function kutupAc(){
  if(typeof cevrimiciAktif!=='undefined' && cevrimiciAktif && !oyunBitti){
    if(typeof anlatimGoster==='function') anlatimGoster(metniCevir('Devam eden çevrimiçi oyunun var'),3000);
    return;
  }
  let z=document.getElementById('kutupEkran');
  if(!z){ z=document.createElement('div'); z.id='kutupEkran'; document.body.appendChild(z); }
  tasSinifKur();
  const en=(typeof uygDil!=='undefined' && uygDil && uygDil!=='tr');
  const S=(tr,e)=>en?e:tr;
  let h='<div class="ogUst"><button type="button" id="kpGeri">‹</button><span>'+S('Kütüphane','Library')+'</span></div>'+
    '<div class="ogAlt">'+S('Kurallar, satranç varyantları ve tarihin efsane maçları.','Rules, chess variants and the legendary games of history.')+'</div>'+
    '<div class="kpSekmeler">'+
      [['kural',S('Kurallar','Rules')],['varyant',S('Varyantlar','Variants')],['mac',S('Efsane Maçlar','Legendary Games')]]
        .map(([k,ad])=>'<button type="button" class="kpSekme'+(kutupSekme===k?' secili':'')+'" data-k="'+k+'">'+ad+'</button>').join('')+
    '</div>';
  if(kutupSekme==='mac'){
    KUTUP_MAC.forEach((m,i)=>{
      const [ad,metin]=kutupDil(m);
      const hs=Math.ceil((KUTUP_HAMLE[m.id]||'').split(' ').filter(Boolean).length/2);
      h+='<div class="kpMac"><div class="kpMacBas">'+kutupTahta(KUTUP_SON[m.id]||'8/8/8/8/8/8/8/8')+'<div class="kpMacBilgi">'+
        '<span class="kpYil">'+m.y+'</span><b>'+kutupKac(ad)+'</b>'+
        '<div class="kpOy"><span>'+kutupKac(m.b)+'</span></div><div class="kpOy s"><span>'+kutupKac(m.s)+'</span></div>'+
        '<div class="kpAlt">'+m.son+' · '+hs+' '+S('hamle','moves')+' · '+kutupKac(m.yer)+'</div></div></div>'+
        '<p>'+kutupKac(metin)+'</p>'+
        '<button type="button" class="kpIzle" data-i="'+i+'">▶ '+S('Hikâyeyi izle','Watch the story')+'</button></div>';
    });
  } else {
    const liste=(kutupSekme==='kural')?KUTUP_KURAL:KUTUP_VARYANT;
    const ikonlar=(kutupSekme==='kural')?KUTUP_IK_KURAL:KUTUP_IK_VARYANT;
    liste.forEach((k,i)=>{
      const [ad,metin]=kutupDil(k);
      h+='<details class="kpMadde"><summary>'+kutupIkon(ikonlar[i])+'<span>'+kutupKac(ad)+'</span></summary><p>'+kutupKac(metin)+'</p></details>';
    });
    if(kutupSekme==='varyant')
      h+='<div class="kpNot">'+S('Bu varyantlar şimdilik yalnızca anlatılıyor; Chess64\'te klasik satranç oynanır.',
                                 'These variants are described here only; Chess64 plays classical chess.')+'</div>';
  }
  z.innerHTML=h;
  z.classList.add('acik');
  try{ if(typeof agacTara==='function') agacTara(z); }catch(e){}
  document.getElementById('kpGeri').onclick=kutupKapat;
  z.querySelectorAll('.kpSekme').forEach(b=>{ b.onclick=()=>{ kutupSekme=b.dataset.k; z.scrollTop=0; kutupAc(); }; });
  z.querySelectorAll('.kpIzle').forEach(b=>{ b.onclick=()=>kutupMacIzle(+b.dataset.i); });
}
function kutupKapat(){ const z=document.getElementById('kutupEkran'); if(z) z.classList.remove('acik'); }
/* Efsane maçı inceleme ekranında aç. Hamleler SAN; motorun kendi yazımıyla eşleştirilir (+/# farkı yok sayılır). */
let kutupIzlemede=false;
function kutupMacIzle(i){
  const m=KUTUP_MAC[i]; const sanlar=(KUTUP_HAMLE[m.id]||'').split(' ').filter(Boolean);
  const sade=s=>s.replace(/[+#]/g,'');
  Motor.reset(); const notlar=[];
  for(const s of sanlar){
    const h=Motor.legal(Motor.turn).find(x=>sade(Motor.notasyon(x))===sade(s));
    if(!h) break;
    notlar.push(Motor.notasyon(h)); Motor.yap(h);
  }
  Motor.reset();
  kutupKapat();
  kutupIzlemede=true;
  egitimGorunumAc();
  window._hikayeMac=m; window._hikayeGirisTamam=false;
  document.body.classList.add('hikayede');
  gecmisOyunIncele(notlar);
  const an=KUTUP_ANLATI[m.id];
  if(an) oyunKaydi.forEach((k,i)=>{ if(an.h[i]) k._hikaye=an.h[i]; });
}
/* Hikâye modu: değerlendirme yok, her hamle sırayla anlatılır (inceleme ekranının yorum kartı ve ses altyapısı) */
function hikayeYorumGoster(otomatik){
  const m=window._hikayeMac, el=document.getElementById('inceleYorum'); if(!m||!el) return;
  const dil=(typeof yorumDil!=='undefined' && yorumDil==='en')?1:0;
  const an=KUTUP_ANLATI[m.id]||{g:['',''],h:[]};
  let metin, h;
  el.style.removeProperty('--sc'); el.style.removeProperty('--sca'); el.style.removeProperty('--scb');
  if(inceleIdx<0){
    const [ad]=kutupDil(m); metin=an.g[dil];
    h='<div class="iySatir hkBas"><span class="iyNot">'+kutupKac(ad)+'</span><span class="iyNo">'+m.y+'</span></div><div class="iyMetin">'+kutupKac(metin)+'</div>';
  } else {
    const k=oyunKaydi[inceleIdx], no=Math.floor(inceleIdx/2)+1;
    metin=(k._hikaye&&k._hikaye[dil])||'';
    h='<div class="iySatir"><span class="iyNo">'+(k.renk==='w'?no+'.':no+'…')+'</span><span class="iyNot">'+k.notasyon+'</span></div><div class="iyMetin">'+kutupKac(metin)+'</div>';
  }
  el.innerHTML=h; el.scrollTop=0;
  el.classList.remove('yeni'); void el.offsetWidth; el.classList.add('yeni');
  const devam=()=>{ if(otomatik && inceleOtoCalisirken) otoDevam(500); };
  if(typeof inceleSesAcik!=='undefined' && inceleSesAcik && typeof Konus!=='undefined' && Konus.mevcut() && (otomatik||inceleIdx>=0)){
    Konus.oku(metin, dil?'en-US':'tr-TR', (typeof sesProfili!=='undefined')?sesProfili.cinsiyet:'kadin', devam);
  } else if(otomatik) otoDevam(Math.max(1600, metin.length*62));
}
/* İnceleme kapanınca (tahtadaIncelemeBitir) profil yerine kütüphaneye dön */
function kutupIzlemeBitti(){
  if(!kutupIzlemede) return false;
  kutupIzlemede=false;
  window._hikayeMac=null; document.body.classList.remove('hikayede');
  egitimGorunumKapat();
  document.getElementById('istEkran').classList.remove('acik');
  kutupAc();
  return true;
}
