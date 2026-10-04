# Not: genel açıklamalar entegrasyonda çözüm-sonrası diline çevrildi (bkz. bulmacalar.js).
# Lichess bulmaca veritabanından (CC0) mat bulmacaları seçer ve uygulamanın biçimine çevirir.
# Sütunlar: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
import io, csv, json, random, sys
import zstandard, chess

KAYNAK = 'lichess_db_puzzle.csv.zst'
HEDEF = {1: 200, 2: 200, 3: 150}
DESEN = [  # (Lichess teması, Türkçe açıklama) — öncelik sırasıyla
 ('smotheredMate',   'Boğma matı: kendi taşlarıyla çevrili şah, atın darbesinden kaçamaz.'),
 ('backRankMate',    'Arka sıra matı: piyonlarının arkasına hapsolmuş şah, son sırada yakalanır.'),
 ('anastasiaMate',   'Anastasia matı: at kaçış karelerini keser, kale ya da vezir kenarda bitirir.'),
 ('arabianMate',     'Arap matı: kale ve at birlikte köşedeki şahı kıskaca alır.'),
 ('bodenMate',       'Boden matı: iki fil çapraz hatlardan şahı kıskaca alır.'),
 ('doubleBishopMate','Çift fil matı: iki fil yan yana çaprazlarla şaha kaçış bırakmaz.'),
 ('dovetailMate',    'Kırlangıçkuyruğu matı: vezir, şahın iki kaçış karesini de kapatır.'),
 ('hookMate',        'Kanca matı: kale, at ve piyon birlikte şahı çengelle yakalar.'),
 ('vukovicMate',     'Vukoviç matı: kale ve at uyumuyla şah kenarda mat olur.'),
 ('killBoxMate',     'Kutu matı: kale ve vezir şahı küçük bir kutuya hapseder.'),
 ('balestraMate',    'Balestra matı: fil ve vezir uzaktan şahı yakalar.'),
 ('blindSwineMate',  'Kör domuz matı: yedinci sıradaki iki kale şahı ezer.'),
 ('cornerMate',      'Köşe matı: köşeye sıkışan şah taşların kıskacında kalır.'),
 ('morphysMate',     'Morphy matı: fil ve kale, köşedeki şahı bitirir.'),
 ('pillsburysMate',  'Pillsbury matı: kale ve fil açık hatlardan şahı yakalar.'),
 ('triangleMate',    'Üçgen matı: vezir ve kale şahın etrafında üçgen kurar.'),
 ('operaMate',       'Opera matı: Morphy\'nin meşhur deseni — kale ve fil uyumu.'),
]
GENEL = {
 1: ['Tek doğru hamle: şahın kaçış karelerine dikkat.', 'Her şah çekişine bak — biri mat.',
     'Şahın etrafındaki boş kareleri say; hangisi korumasız?'],
 2: ['Önce zorla, sonra bitir: rakibin cevabı tek olmalı.', 'Şah çekerek başla, rakibe nefes aldırma.',
     'Fedadan korkma: ikinci hamlede mat geliyor.'],
 3: ['Üç hamlelik plan: her hamlen rakibi tek cevaba zorlasın.', 'Taşlarını yaklaştır, kaçış karelerini tek tek kapat.',
     'Sabırlı ol: fedanın karşılığı üçüncü hamlede gelir.'],
}

def notBul(temalar, t, rnd):
    for anahtar, metin in DESEN:
        if anahtar in temalar: return metin
    return rnd.choice(GENEL[t])

def main():
    adaylar = {1: [], 2: [], 3: []}
    dctx = zstandard.ZstdDecompressor()
    with open(KAYNAK, 'rb') as fh, dctx.stream_reader(fh) as okuyucu:
        metin = io.TextIOWrapper(okuyucu, encoding='utf-8')
        for satir in csv.DictReader(metin):
            tem = satir['Themes'].split()
            t = 1 if 'mateIn1' in tem else 2 if 'mateIn2' in tem else 3 if 'mateIn3' in tem else 0
            if not t: continue
            try:
                if int(satir['NbPlays']) < 500 or int(satir['Popularity']) < 85 or int(satir['RatingDeviation']) > 80: continue
            except ValueError: continue
            adaylar[t].append((int(satir['Rating']), satir['PuzzleId'], satir['FEN'], satir['Moves'].split(), tem))
    rnd = random.Random(64)
    sonuc = []
    for t, n in HEDEF.items():
        a = sorted(adaylar[t])
        print('t=%d aday=%d' % (t, len(a)), file=sys.stderr)
        secim = [a[int(i * (len(a) - 1) / (n - 1))] for i in range(n)]  # zorluğa eşit yayılım
        for puan, pid, fen, hamleler, tem in secim:
            b = chess.Board(fen)
            b.push_uci(hamleler[0])                 # rakibin ilk hamlesi
            f = b.fen(); r = 'w' if b.turn == chess.WHITE else 'b'
            cozum = hamleler[1:]
            assert len(cozum) == 2 * t - 1, (pid, len(cozum))
            d = b.copy()
            for u in cozum: d.push_uci(u)
            assert d.is_checkmate(), pid            # çözüm gerçekten mat
            sonuc.append({'f': f, 'r': r, 'h': cozum, 't': t, 'n': notBul(tem, t, rnd), 'p': puan, 'id': pid})
    json.dump(sonuc, open('secilen.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print('secilen', len(sonuc), file=sys.stderr)

main()
