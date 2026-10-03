#!/usr/bin/env python3
"""gltf(+bin,+png) -> tek dosya .glb paketleyici.
Kullanım:
  python3 paketle.py girdi.gltf cikti.glb              # dokuyu gömerek
  python3 paketle.py girdi.gltf cikti.glb R G B        # dokuyu at, düz renk ver (0-1)
"""
import json, struct, sys, os

def pad4(b, dolgu=b'\x00'):
    return b + dolgu * ((4 - len(b) % 4) % 4)

def paketle(gltf_yolu, cikti, tint=None):
    kok = os.path.dirname(os.path.abspath(gltf_yolu))
    j = json.load(open(gltf_yolu))
    bin_veri = b''
    # 1) mevcut buffer'ları tek buffer'da birleştir
    ofsetler = []
    for b in j.get('buffers', []):
        ofsetler.append(len(bin_veri))
        bin_veri += open(os.path.join(kok, b['uri']), 'rb').read()
        bin_veri = pad4(bin_veri)
    for bv in j.get('bufferViews', []):
        bv['byteOffset'] = bv.get('byteOffset', 0) + ofsetler[bv.get('buffer', 0)]
        bv['buffer'] = 0
    # 2) görseller: tint istenirse at, istenmezse buffer'a göm
    if tint is not None:
        j.pop('images', None); j.pop('textures', None); j.pop('samplers', None)
        for m in j.get('materials', []):
            pbr = m.setdefault('pbrMetallicRoughness', {})
            pbr.pop('baseColorTexture', None)
            pbr['baseColorFactor'] = [tint[0], tint[1], tint[2], 1.0]
    else:
        for img in j.get('images', []):
            if 'uri' in img:
                veri = open(os.path.join(kok, img['uri']), 'rb').read()
                bv_index = len(j.setdefault('bufferViews', []))
                j['bufferViews'].append({'buffer':0,'byteOffset':len(bin_veri),'byteLength':len(veri)})
                bin_veri = pad4(bin_veri + veri)
                img.pop('uri'); img['bufferView']=bv_index; img.setdefault('mimeType','image/png')
    j['buffers'] = [{'byteLength': len(bin_veri)}]
    # 3) GLB yaz
    js = pad4(json.dumps(j, separators=(',',':')).encode(), b' ')
    bb = pad4(bin_veri)
    toplam = 12 + 8 + len(js) + 8 + len(bb)
    with open(cikti,'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, toplam))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bb), 0x004E4942)); f.write(bb)
    print(cikti, os.path.getsize(cikti), 'bayt')

if __name__=='__main__':
    g, c = sys.argv[1], sys.argv[2]
    t = tuple(float(x) for x in sys.argv[3:6]) if len(sys.argv)>=6 else None
    paketle(g, c, t)
