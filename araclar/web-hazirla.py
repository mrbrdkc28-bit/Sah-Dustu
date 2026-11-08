# -*- coding: utf-8 -*-
"""Chess64 tarayıcı (PC) sürümü — oyun dosyalarını Android projesinden alıp masaüstüne ayrı klasör yapar.

Kullanım:  python araclar/web-hazirla.py  [hedef klasör]
Varsayılan hedef: Masaüstü\\Chess64-Web

Şimdilik yalnız yerel deneme içindir (sahibin isteği, Kasım 2026): yayına konmaz.
Klasördeki "Chess64-Oyna.bat" yerel bir sunucu açar ve oyunu tarayıcıda başlatır (Python gerekir).
Oyun dosyaları doğrudan çift tıklanarak (file://) açılamaz: 3B modeller ve motor güvenlik gereği sunucu ister.

Tarayıcıda farklı olanlar:
  - Android köprüsü olmadığından reklam ve satın alma yoktur; kilitli içerik açık gelir (index.html: kilitli()).
  - Google ile giriş açılır pencereyle (popup) yapılır; localhost Firebase'de varsayılan olarak izinlidir.
  - Hesap yalnız uygulamada açılır: tarayıcıda kayıt ve misafir düğmesi yok, profili olmayan hesap içeri alınmaz
    (index.html: WEB_SURUM denetimleri, webHesapYok).
  - window.WEB_SURUM=true işareti eklenir; ekran geniş olduğunda arayüz ortalanır (web-ek.css).
"""
import os, shutil, sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = os.path.join(KOK, 'app', 'src', 'main', 'assets')
HEDEF = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser('~'), 'Desktop', 'Chess64-Web'))
OYUN = os.path.join(HEDEF, 'oyun')

BAT = r'''@echo off
title Chess64 (tarayici)
cd /d "%~dp0oyun"
echo Chess64 yerel sunucu aciliyor: http://localhost:8064
echo Bu pencereyi kapatinca oyun da kapanir.
start "" http://localhost:8064/
python -m http.server 8064 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo Python bulunamadi. https://www.python.org adresinden kurup tekrar deneyin.
  pause
)
'''

BENIOKU = '''Chess64 – tarayıcı sürümü (yerel deneme)

1. "Chess64-Oyna.bat" dosyasına çift tıkla.
2. Tarayıcıda http://localhost:8064 açılır. Açılmazsa adresi kendin yaz.
3. Oyunu kapatmak için siyah komut penceresini kapat.

Not: Bu klasör şimdilik yalnız deneme içindir, internete konmadı.
Google ile giriş, çevrimiçi maç ve arkadaşlar telefondaki hesapla aynı şekilde çalışır.
'''

def main():
    # Klasörün kendisi silinmez: Chess64-Oyna.bat açıkken sunucu bu klasörde çalışır (Windows klasörü kilitler).
    os.makedirs(OYUN, exist_ok=True)
    for ad in os.listdir(OYUN):
        y = os.path.join(OYUN, ad)
        shutil.rmtree(y) if os.path.isdir(y) else os.remove(y)
    shutil.copytree(KAYNAK, OYUN, dirs_exist_ok=True)
    p = os.path.join(OYUN, 'index.html')
    s = open(p, encoding='utf-8').read()
    isaret = '<head>'
    assert s.count(isaret) == 1, 'head etiketi bulunamadı'
    s = s.replace(isaret, '<head>\n<script>window.WEB_SURUM=true;document.documentElement.classList.add(\"web\");</script>\n<link rel="stylesheet" href="web-ek.css">', 1)
    govde = s.rindex('</body>')
    s = s[:govde] + '<script src="qrcode.js"></script>\n<script src="web-qr.js"></script>\n' + s[govde:]
    open(p, 'w', encoding='utf-8', newline='\n').write(s)
    shutil.copy(os.path.join(KOK, 'araclar', 'web-ek.css'), os.path.join(OYUN, 'web-ek.css'))
    for ad in ('qrcode.js', 'web-qr.js', 'qrcode-LICENSE.txt'):
        k = os.path.join(KOK, 'araclar', 'web', ad)
        if os.path.exists(k): shutil.copy(k, os.path.join(OYUN, ad))
    open(os.path.join(HEDEF, 'Chess64-Oyna.bat'), 'w', encoding='ascii', newline='\r\n').write(BAT)
    open(os.path.join(HEDEF, 'BENIOKU.txt'), 'w', encoding='utf-8-sig', newline='\r\n').write(BENIOKU)
    print('Tarayıcı sürümü hazır:', HEDEF)

if __name__ == '__main__':
    main()
