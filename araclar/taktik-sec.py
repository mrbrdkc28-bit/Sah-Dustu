# Lichess açık bulmaca veritabanından (CC0, database.lichess.org) TAKTİK bulmacaları seçer (Kasım 2026).
# Kullanım: python araclar/taktik-sec.py lichess_db_puzzle.csv.zst app/src/main/assets/taktikler.js
# Sütunlar: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
# Lichess düzeni: FEN rakibin hamlesinden ÖNCEKİ konum; Moves[0] rakibin hamlesi, gerisi çözüm (oyuncu/rakip sırayla).
import io, csv, json, random, sys
import zstandard, chess

KAYNAK, HEDEF_JS = sys.argv[1], sys.argv[2]
ADET = 60
# (uygulamadaki anahtar, Lichess teması, başarı notu) — öncelik sırasıyla; bir bulmaca tek temaya girer
TEMALAR = [
 ('catal',    'fork',              'Çatal: tek taşla iki hedefe aynı anda saldırdın, rakip ikisini birden kurtaramaz.'),
 ('acmaz',    'pin',               'Açmaz: arkadaki değerli taş yüzünden öndeki taş kıpırdayamıyor.'),
 ('sis',      'skewer',            'Şiş: değerli taş kaçınca arkasındaki taş açıkta kaldı.'),
 ('acarak',   'discoveredAttack',  'Açarak saldırı: bir taş çekildi, arkasındaki taşın saldırısı ortaya çıktı.'),
 ('saptirma', 'deflection',        'Saptırma: savunan taşı görevinden uzaklaştırdın.'),
 ('cekme',    'attraction',        'Çekme: rakip taşı kötü bir kareye gelmeye zorladın.'),
 ('arahamle', 'intermezzo',        'Ara hamle: beklenen hamleden önce daha güçlü bir tehdit araya girdi.'),
 ('kapan',    'trappedPiece',      'Kapan: rakip taşın kaçacak güvenli karesi kalmadı.'),
]

def main():
    aday = {k: [] for k, _, _ in TEMALAR}
    dctx = zstandard.ZstdDecompressor()
    with open(KAYNAK, 'rb') as fh, dctx.stream_reader(fh) as okuyucu:
        for s in csv.DictReader(io.TextIOWrapper(okuyucu, encoding='utf-8')):
            tem = s['Themes'].split()
            if any(t.startswith('mate') for t in tem): continue          # mat bulmacaları ayrı bölümde
            try:
                puan = int(s['Rating'])
                if int(s['NbPlays']) < 1000 or int(s['Popularity']) < 88 or int(s['RatingDeviation']) > 80: continue
            except ValueError: continue
            if not 800 <= puan <= 2200: continue
            h = s['Moves'].split()
            if len(h) not in (2, 4, 6): continue                         # çözüm 1-3 oyuncu hamlesi
            if any(len(u) != 4 for u in h): continue                     # terfi yok (tahtada terfi seçimi sorulmasın)
            for k, lt, _ in TEMALAR:
                if lt in tem:
                    aday[k].append((puan, s['PuzzleId'], s['FEN'], h)); break
    rnd = random.Random(64); sonuc = []; gorulen = set()
    for k, lt, notu in TEMALAR:
        a = sorted(aday[k]); print(k, 'aday', len(a), file=sys.stderr)
        if len(a) < ADET: sys.exit('az aday: ' + k)
        secim = [a[int(i * (len(a) - 1) / (ADET - 1))] for i in range(ADET)]
        for puan, pid, fen, h in secim:
            b = chess.Board(fen)
            b.push_uci(h[0])
            f = b.fen()
            if f in gorulen: continue
            d = b.copy()
            for u in h[1:]:
                assert chess.Move.from_uci(u) in d.legal_moves, pid
                d.push_uci(u)
            gorulen.add(f)
            sonuc.append({'f': f, 'r': 'w' if b.turn == chess.WHITE else 'b', 'h': h[1:], 't': k, 'n': notu, 'p': puan, 'id': pid})
    with open(HEDEF_JS, 'w', encoding='utf-8', newline='\n') as o:
        o.write('/* Lichess açık bulmaca veritabanından seçilmiş TAKTİK bulmacaları (CC0, database.lichess.org).\n'
                '   Kasım 2026: 8 tema x %d (çatal, açmaz, şiş, açarak saldırı, saptırma, çekme, ara hamle, kapan).\n'
                '   Ölçüt: >=1000 oynanma, >=%%88 beğeni, puan 800-2200, terfisiz, 1-3 oyuncu hamlesi; çözüm python-chess\n'
                '   ile yasal olduğu doğrulanarak üretildi (araclar/taktik-sec.py). t = tema anahtarı, p = Lichess puanı. */\n'
                'const TAKTIK_EK=[\n' % ADET)
        o.write(',\n'.join(json.dumps(x, ensure_ascii=False, separators=(',', ':')) for x in sonuc))
        o.write('\n];\n(function(){ if(typeof BULMACALAR==="undefined") return;\n'
                '  const var_=new Set(BULMACALAR.map(b=>b.f));\n'
                '  TAKTIK_EK.forEach(b=>{ if(!var_.has(b.f)){ BULMACALAR.push(b); var_.add(b.f); } });\n})();\n')
    print('secilen', len(sonuc), file=sys.stderr)

main()
