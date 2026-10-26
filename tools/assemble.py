import sys
S=sys.argv[1]

def read(path, encoding=None):
    with open(path, encoding=encoding) as source:
        return source.read()

s=read(f"{S}/index.src.html")
def js(path):
    return read(path).replace("</","<\\/")
s=s.replace("/*DATA*/",js(f"{S}/site/data.json")).replace("/*PARTS*/",js(f"{S}/site/parts.json")).replace("/*TEXT*/",js(f"{S}/site/text.json")).replace("/*PAGES*/",js(f"{S}/pages_meta.json"))
s=s.replace("/*READJSON*/",js(f"{S}/reader.json")).replace("/*READHTML*/",read(f"{S}/reader.html",encoding="utf-8"))
with open(f"{S}/site/index.html","w") as target:
    target.write(s)
print(len(s)//1024,"KB")
