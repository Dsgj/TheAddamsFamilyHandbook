import cv2, numpy as np, pytesseract, json, sys
S=sys.argv[1]
out={}
for p in (97,98,99):
    img=cv2.imread(f"{S}/pg/hi{p}-0{p}.png",0)
    H,W=img.shape
    bw=(img<110).astype(np.uint8)
    k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11))
    filled=cv2.morphologyEx(bw,cv2.MORPH_CLOSE,k)
    dt=cv2.distanceTransform(filled,cv2.DIST_L2,5)
    core=(dt>float(sys.argv[2])).astype(np.uint8)
    n,lab,st,cen=cv2.connectedComponentsWithStats(core)
    res=[]
    for i in range(1,n):
        cx,cy=cen[i]
        r=int(dt[lab==i].max())
        R=r+2
        x0,y0=int(cx-R*1.25),int(cy-R)
        roi=img[max(0,y0):int(cy+R),max(0,x0):int(cx+R*1.25)]
        inv=255-roi
        # mask outside circle to white(after invert -> black is text?) keep simple
        inv=cv2.resize(inv,None,fx=3,fy=3,interpolation=cv2.INTER_CUBIC)
        _,th=cv2.threshold(inv,127,255,cv2.THRESH_BINARY)
        th=cv2.copyMakeBorder(th,30,30,30,30,cv2.BORDER_CONSTANT,value=255)
        txt=pytesseract.image_to_string(th,config="--psm 7 -c tessedit_char_whitelist=0123456789ab").strip()
        res.append(dict(cx=round(float(cx)),cy=round(float(cy)),r=r,txt=txt))
    out[p]=dict(W=W,H=H,items=res)
    print(p,len(res),sorted(r['txt'] for r in res))
json.dump(out,open(f"{S}/callouts_raw.json","w"))
