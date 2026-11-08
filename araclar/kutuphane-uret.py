# app/src/main/assets/kutuphane.js dosyasını üretir: metinler (kutuphane-govde.js) + doğrulanmış hamleler + arayüz.
# Kullanım: python araclar/kutuphane-uret.py
import importlib.util, io, contextlib, json, os
KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(KOK, 'araclar')
sp = importlib.util.spec_from_file_location('e', os.path.join(A, 'efsane-dogrula.py'))
m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
with contextlib.redirect_stdout(io.StringIO()):
    hamle = {k: ' '.join(v) for k, v in m.dogrula().items()}
govde = open(os.path.join(A, 'kutuphane-govde.js'), encoding='utf-8').read()
for mid in __import__('re').findall(r"\{id:'(\w+)'", govde):
    assert mid in hamle, 'hamlesi olmayan maç: ' + mid
arayuz = open(os.path.join(A, 'kutuphane-arayuz.js'), encoding='utf-8').read()
son = {}; anlati = {}
sp2 = importlib.util.spec_from_file_location('h', os.path.join(A, 'efsane_anlatim.py'))
h = importlib.util.module_from_spec(sp2); sp2.loader.exec_module(h)
chess = m.chess
TR_AD = {1: ('piyon', 'piyonunu', 'piyonuyla', 'piyonu'), 2: ('at', 'atını', 'atıyla', 'atı'), 3: ('fil', 'filini', 'filiyle', 'fili'),
         4: ('kale', 'kalesini', 'kalesiyle', 'kaleyi'), 5: ('vezir', 'vezirini', 'veziriyle', 'veziri'), 6: ('şah', 'şahını', 'şahıyla', 'şahı')}
EN_AD = {1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king'}
YONELME = {'1': 'e', '2': 'ye', '3': 'e', '4': 'e', '5': 'e', '6': 'ya', '7': 'ye', '8': 'e'}
BULUNMA = {'1': 'de', '2': 'de', '3': 'te', '4': 'te', '5': 'te', '6': 'da', '7': 'de', '8': 'de'}
def cumle(b, mv, ad, i):
    n = chess.square_name(mv.to_square); p = b.piece_at(mv.from_square).piece_type
    ye = n + "'" + YONELME[n[1]]; de = n + "'" + BULUNMA[n[1]]
    t = TR_AD[p]; e = EN_AD[p]; c = i % 3
    if b.is_castling(mv):
        kisa = chess.square_file(mv.to_square) == 6
        tr = f"{ad} {'kısa' if kisa else 'uzun'} rok yapıyor, şahını güvenceye alıyor."
        en = f"{ad} castles {'kingside' if kisa else 'queenside'}, tucking the king away."
    elif b.is_capture(mv):
        kp = chess.PAWN if b.is_en_passant(mv) else b.piece_at(mv.to_square).piece_type
        tr = [f"{ad} {t[2]} {de} duran {TR_AD[kp][3]} alıyor.", f"{ad}, {de} {TR_AD[kp][3]} alıyor; {t[0]} oraya yerleşiyor.", f"Değişim: {ad} {t[2]} {TR_AD[kp][3]} alıyor, {n}."][c]
        en = [f"{ad} takes the {EN_AD[kp]} on {n} with the {e}.", f"{ad} captures the {EN_AD[kp]} on {n}.", f"A capture: {ad}'s {e} takes the {EN_AD[kp]} on {n}."][c]
    elif p == chess.PAWN:
        tr = [f"{ad} {n[0]} piyonunu {ye} sürüyor.", f"{ad} piyonla ilerliyor: {n}.", f"{ad}, {n[0]} piyonuyla bir adım daha atıyor, {n}."][c]
        en = [f"{ad} pushes the {n[0]}-pawn to {n}.", f"{ad} advances a pawn to {n}.", f"{ad}'s {n[0]}-pawn steps forward to {n}."][c]
    else:
        tr = [f"{ad} {t[1]} {ye} getiriyor.", f"{ad} {t[1]} {ye} çekiyor.", f"{ad}, {t[2]} {ye} geçiyor."][c]
        en = [f"{ad} brings the {e} to {n}.", f"{ad} moves the {e} to {n}.", f"{ad}'s {e} goes to {n}."][c]
    b.push(mv); mat = b.is_checkmate(); sah = b.is_check(); b.pop()
    return (tr + (' Mat!' if mat else ' Şah!' if sah else ''), en + (' Checkmate!' if mat else ' Check!' if sah else ''))
for k, v in hamle.items():
    b = chess.Board(); H = h.HIKAYE[k]; ozel = {x: y for x, y in H.items() if ':' in x}; kullanilan = 0; satir = []
    for i, x in enumerate(v.split()):
        mv = b.parse_san(x); no = i // 2 + 1; an = f"{no}{'w' if i % 2 == 0 else 'b'}:{x}"
        ad = H['b'] if i % 2 == 0 else H['s']
        if an in ozel: satir.append(list(ozel[an])); kullanilan += 1
        else: satir.append(list(cumle(b, mv, ad, i)))
        b.push(mv)
    assert kullanilan == len(ozel), (k, 'eşleşmeyen anahtar', [o for o in ozel if o.split(':')[1] not in v.split()], kullanilan, len(ozel))
    anlati[k] = {'g': list(H['giris']), 'h': satir}
    son[k] = b.board_fen()
cikti = govde + 'const KUTUP_HAMLE=' + json.dumps(hamle, ensure_ascii=False, indent=0) + ';\nconst KUTUP_SON=' + json.dumps(son) + ';\nconst KUTUP_ANLATI=' + json.dumps(anlati, ensure_ascii=False, separators=(',', ':')) + ';\n' + arayuz
open(os.path.join(KOK, 'app', 'src', 'main', 'assets', 'kutuphane.js'), 'w', encoding='utf-8', newline='\n').write(cikti)
print('kutuphane.js yazildi,', len(cikti), 'karakter,', len(hamle), 'mac')
