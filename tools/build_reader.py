import markdown, re, json, sys, html
S = sys.argv[1]
# Reading sections (Swedish titles) -> pages in reading order
SECTIONS = [
    ("snabb", "Snabbreferens och innehåll", [2, 3]),
    ("regler", "Regler och shot maps", [5, 6, 7, 8, 9, 10]),
    ("drift", "Montering och drift", [11, 12, 13, 14, 15, 16]),
    ("bokforing", "Menysystemet och bokföring", [17, 18, 19, 20, 21, 22, 23, 24]),
    ("test", "Testmenyn", [25, 26, 27, 28, 29]),
    ("utilities", "Utilities", [30, 31, 37]),
    ("presets", "Svårighetsgrad och presets", [32, 33, 34, 35, 36]),
    ("justeringar", "Justeringar A.1–A.5", list(range(38, 54))),
    ("fel", "Felmeddelanden och felkoder", [54, 55]),
    ("led", "LED, säkringar och underhåll", [56, 57, 58]),
]
md = markdown.Markdown(extensions=["tables", "sane_lists"])
toc, plain, out = [], {}, []
for key, title, pages in SECTIONS:
    sid = f"rs-{key}"
    toc.append([sid, 1, title, pages[0]])
    parts = []
    for p in pages:
        src = open(f"{S}/trans/ops{p}.md", encoding="utf-8").read()
        m = re.match(r"<!--\s*page\s*\d+\s*(?:\|\s*label\s*([^ ]+?))?\s*-->", src)
        label = m.group(1) if m and m.group(1) else ""
        body = re.sub(r"^<!--.*?-->\s*", "", src, flags=re.S)
        md.reset()
        h = md.convert(body)
        k = [0]
        def hid(mm):
            lvl, inner = int(mm.group(1)), mm.group(2)
            k[0] += 1
            i = f"r{p}-{k[0]}"
            lv = 2 if lvl <= 2 else 3
            toc.append([i, lv, html.unescape(re.sub(r"<[^>]+>", "", inner)).strip(), p])
            tag = "h3" if lv == 2 else "h4"
            return f'<{tag} id="{i}">{inner}</{tag}>'
        h = re.sub(r"<h([1-4])>(.*?)</h\1>", hid, h, flags=re.S)
        h = h.replace("<table>", '<div class="scroll-x"><table class="t static rt">').replace("</table>", "</table></div>")
        def fig(mm):
            from PIL import Image
            alt, src = mm.group(1), mm.group(2)
            w, hh = Image.open(f"{S}/site/{src}").size
            return (f'<figure class="rfig"><img src="{src}" alt="{alt}" loading="lazy" width="{w//2}" height="{hh//2}" '
                    f'style="width:{w//2}px;max-width:100%;height:auto"><figcaption>{alt}</figcaption></figure>')
        h = re.sub(r'<p><img alt="([^"]*)" src="([^"]+)"\s*/?></p>', fig, h)
        h = re.sub(r"<p><em>\[Figure:\s*(.*?)\]</em></p>", r'<p class="fig">Bild i originalet: \1</p>', h)
        lab = f"s. {label}" if label else f"PDF-sida {p}"
        parts.append(f'<div class="rp" id="rp-{p}"><div class="rp-bar"><span class="mono">{lab}</span>'
                     f'<button data-page="ops:{p}">original</button></div>{h}</div>')
        plain[p] = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()
    out.append(f'<section class="rs" id="{sid}"><h2 class="rs-h">{html.escape(title)}</h2>{"".join(parts)}</section>')
open(f"{S}/reader.html", "w", encoding="utf-8").write("\n".join(out))
json.dump({"toc": toc, "plain": plain}, open(f"{S}/reader.json", "w", encoding="utf-8"), ensure_ascii=False)
print(len(toc), "toc entries,", len(plain), "pages")
