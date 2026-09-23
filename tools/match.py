import json,sys,cv2,math
from approx import A
S=sys.argv[1]
raw=json.load(open(f"{S}/callouts_raw.json"))
final={}
for p,txt in A.items():
    det=raw[str(p)]["items"]; W=raw[str(p)]["W"]; H=raw[str(p)]["H"]
    img=cv2.imread(f"{S}/pg/hi{p}-0{p}.png")
    lst=[]
    for e in txt.split(";"):
        lab,x,y=e.split(); x,y=int(x)*2,int(y)*2
        best=min(det,key=lambda d:(d['cx']-x)**2+(d['cy']-y)**2)
        dist=math.hypot(best['cx']-x,best['cy']-y)
        cx,cy=(best['cx'],best['cy']) if dist<45 else (x,y)
        lst.append(dict(label=lab,x=round(cx/W,4),y=round(cy/H,4),snap=dist<45,d=round(dist)))
        col=(0,0,255) if dist<45 else (255,0,255)
        cv2.circle(img,(cx,cy),40,col,4)
        cv2.putText(img,lab,(cx+42,cy-30),cv2.FONT_HERSHEY_SIMPLEX,1.3,col,3)
    final[p]=lst
    print(p,"unsnapped:",[l['label'] for l in lst if not l['snap']], "max d", max(l['d'] for l in lst if l['snap']))
    # crop diagram area
    xs=[int(l['x']*W) for l in lst]; 
    x0=max(0,min(xs)-120)
    small=cv2.resize(img[:, x0:],None,fx=0.5,fy=0.5)
    cv2.imwrite(f"{S}/ov{p}.png",small)
json.dump(final,open(f"{S}/callouts.json","w"),indent=0)
