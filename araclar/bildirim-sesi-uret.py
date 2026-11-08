# Chess64 bildirim sesi üretici (Kasım 2026): tahtaya konan taşın tok sesi + iki notalı yumuşak çan (marimba benzeri).
# Tamamen sentez, lisans gerekmez. Çıktı: WAV (iOS bildirim sesi) ve OGG (Android res/raw).
# Kullanım: python araclar/bildirim-sesi-uret.py <hedef klasör> [cesit]
import math, array, struct, sys, os, random, subprocess
SR = 44100

def sentez(cesit='a'):
    n = int(SR * 1.05); y = [0.0] * n
    rnd = random.Random(64)
    # 1) Tok "tak": kısa gürültü patlaması + 180 Hz gövde, 40 ms
    for i in range(int(.045 * SR)):
        t = i / SR; z = math.exp(-t * 90)
        y[i] += (rnd.uniform(-1, 1) * .35 + math.sin(2 * math.pi * 180 * t) * .6) * z * .55
    # 2) İki nota: marimba benzeri (temel + 4x kısmi), üstel sönüm
    notalar = {'a': [(.06, 659.25), (.20, 987.77)],      # Mi5 → Si5 (yükselen beşli)
               'b': [(.06, 783.99), (.19, 1174.66)],     # Sol5 → Re6
               'c': [(.06, 523.25), (.17, 783.99), (.30, 1046.5)]}[cesit]
    for bas, f in notalar:
        b0 = int(bas * SR)
        for i in range(n - b0):
            t = i / SR
            zarf = math.exp(-t * 6.5) * (1 - math.exp(-t * 400))
            v = math.sin(2 * math.pi * f * t) + .28 * math.sin(2 * math.pi * f * 3.98 * t) * math.exp(-t * 18) \
                + .12 * math.sin(2 * math.pi * f * 2 * t) * math.exp(-t * 9)
            y[b0 + i] += v * zarf * .42
    tepe = max(abs(v) for v in y) or 1
    k = int(.04 * SR)
    return [v / tepe * .82 * (1 if i < n - k else (n - i) / k) for i, v in enumerate(y)]

def yaz(hedef, cesit='a'):
    os.makedirs(hedef, exist_ok=True)
    y = sentez(cesit)
    pcm = array.array('h', [int(v * 32767) for v in y]).tobytes()
    wav = os.path.join(hedef, 'bildirim.wav')
    with open(wav, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(pcm)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16) + b'data' + struct.pack('<I', len(pcm)) + pcm)
    try:
        import imageio_ffmpeg
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', '5', os.path.join(hedef, 'bildirim.ogg')], check=True)
    except Exception as e:
        print('OGG üretilemedi:', e)
    print('yazıldı:', hedef)

if __name__ == '__main__':
    yaz(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'a')
