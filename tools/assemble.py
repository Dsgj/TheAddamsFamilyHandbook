import json,sys
S=sys.argv[1]
s=open(f"{S}/index.src.html").read()
def js(path):
    return open(path).read().replace("</","<\\/")
s=s.replace("/*DATA*/",js(f"{S}/site/data.json")).replace("/*PARTS*/",js(f"{S}/site/parts.json")).replace("/*TEXT*/",js(f"{S}/site/text.json")).replace("/*PAGES*/",js(f"{S}/pages_meta.json"))
s=s.replace("/*READJSON*/",js(f"{S}/reader.json")).replace("/*READHTML*/",open(f"{S}/reader.html",encoding="utf-8").read())
open(f"{S}/site/index.html","w").write(s)
print(len(s)//1024,"KB")
