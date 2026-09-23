import glob, os, json, sys
from PIL import Image
from concurrent.futures import ProcessPoolExecutor
S=sys.argv[1]
def q4(im):
    im=im.convert("L")
    q=im.point(lambda v: int(round(v/85)*85))
    return q.convert("P", palette=Image.ADAPTIVE, colors=4)
def save(im,path): q4(im).save(path,"PNG",optimize=True,bits=2)
def job(f):
    base=os.path.basename(f)[:-4]; doc,num=base.split("-"); n=int(num)
    im=Image.open(f)
    out=[]
    if doc=="wpc" and n>1:
        W,H=im.size; hw,hh=W//2,H//2
        for r in range(2):
            for c in range(2):
                save(im.crop((c*hw,r*hh,W if c else hw,H if r else hh)), f"{S}/site/p/wpc/{n}_{r}{c}.png")
        save(im.resize((W//4,H//4),Image.LANCZOS), f"{S}/site/p/wpc/{n}_o.png")
        out=[n,W,H,True]
    else:
        save(im, f"{S}/site/p/{doc}/{n}.png"); out=[n,*im.size,False]
    return doc,out
if __name__=="__main__":
    fs=sorted(glob.glob(f"{S}/raw/*-*.png"))
    meta={}
    with ProcessPoolExecutor(8) as ex:
        for doc,o in ex.map(job,fs): meta.setdefault(doc,[]).append(o)
    for k in meta: meta[k].sort()
    json.dump(meta,open(f"{S}/pages_meta.json","w"))
    print({k:len(v) for k,v in meta.items()})
