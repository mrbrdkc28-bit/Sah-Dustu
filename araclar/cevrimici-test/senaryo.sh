#!/bin/bash
# senaryo.sh <dkA> <incA> <sahneA> <dkB> <incB> <sahneB>
cd "$(dirname "$0")"
ara(){ node cdp.mjs $1 "(async()=>{ bulutIst.kullaniciAdi='$2'; cvSecilenSure={dk:$3,inc:$4}; sahneAyari=$5; cevrimiciAc(); await Cevrimici.rastgeleEsles(); return 'aradi '+Cevrimici.durum })()"; }
durum(){ node cdp.mjs $1 "(()=>[Cevrimici.durum, Cevrimici.odaId||'-', Cevrimici.benimRenk||'-', cevrimiciAktif, 'sure='+sureSecim, 'sabit='+cvSahneSabit, 'odaSahne='+(Cevrimici.veri?Cevrimici.veri.sahne:'?')].join(' '))()"; }
ara 9301 TestA $1 $2 $3; sleep 2; ara 9302 TestB $4 $5 $6; sleep 6
echo "A: $(durum 9301)"; echo "B: $(durum 9302)"
