# Bildirim sesleri (Kasım 2026): Freesound CC0 önizlemelerinden kırpılıp seviyelenir.
#   ses_davet  <- #456965 "Short Success Sound Glockenspiel Treasure Video Game" (FunWithSound)  — oyun isteği
#   ses_genel  <- #625174 "[UI Sound] Approval - High Pitched Bell Synth" (GabFitzgerald)          — hatırlatma, çevrimiçi
# Android: app/src/main/res/raw/<ad>.ogg   iOS: <hedef>/<ad>.wav (bildirim sesi wav/caf/aiff olmalı)
# Kullanım: python araclar/bildirim-sesi-hazirla.py <indirilen mp3 klasörü> [ios wav klasörü]
import subprocess, array, struct, os, sys, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe(); SR = 44100
KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = sys.argv[1]
IOS = sys.argv[2] if len(sys.argv) > 2 else None
RAW = os.path.join(KOK, 'app', 'src', 'main', 'res', 'raw')
os.makedirs(RAW, exist_ok=True)
for dosya, ad, maks in [('aday5.mp3', 'ses_davet', 2.4), ('aday6.mp3', 'ses_genel', 1.6)]:
    ham = subprocess.run([FF, '-v', 'error', '-i', os.path.join(KAYNAK, dosya), '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    a = array.array('h'); a.frombytes(ham); x = [v / 32768 for v in a]
    t = max(abs(v) for v in x) or 1
    bas = next((i for i, v in enumerate(x) if abs(v) > .02 * t), 0)
    y = x[bas:bas + int(maks * SR)]; L = len(y); k = int(.05 * SR)
    t2 = max(abs(v) for v in y) or 1
    y = [v / t2 * .85 * (1 if i < L - k else (L - i) / k) for i, v in enumerate(y)]
    pcm = array.array('h', [int(v * 32767) for v in y]).tobytes()
    subprocess.run([FF, '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libvorbis', '-q:a', '6',
                    os.path.join(RAW, ad + '.ogg')], input=pcm, check=True)
    if IOS:
        os.makedirs(IOS, exist_ok=True)
        with open(os.path.join(IOS, ad + '.wav'), 'wb') as f:
            f.write(b'RIFF' + struct.pack('<I', 36 + len(pcm)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16)
                    + b'data' + struct.pack('<I', len(pcm)) + pcm)
    print(ad, round(L / SR, 2), 'sn')
