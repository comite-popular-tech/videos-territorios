# Gera saida/videos.html: todos os vídeos de Saúde já renderizados, com busca por cidade. Rodar de novo para atualizar.
#   python video/galeria.py
import json, html
from pathlib import Path
RAIZ = Path(__file__).resolve().parent.parent
itens = []
for mp4 in sorted((RAIZ / "saida/brasil").glob("*/video/saude.mp4")):
    slug = mp4.parent.parent.name
    pj = mp4.parent / "saude.props.json"
    p = json.loads(pj.read_text(encoding="utf-8")) if pj.exists() else {}
    nome = f"{p.get('cidade', slug)} ({p.get('uf', slug[:2].upper())})"
    itens.append(f'<figure data-n="{html.escape(nome.lower())}"><video src="brasil/{slug}/video/saude.mp4" controls preload="none" '
                 f'poster="brasil/{slug}/video/saude-abertura.png"></video><figcaption>{html.escape(nome)} · '
                 f'{p.get("fundo", "")}</figcaption></figure>')
(RAIZ / "saida/videos.html").write_text(f"""<!doctype html><meta charset="utf-8"><title>Vídeos de Saúde</title>
<style>body{{font:15px system-ui;margin:16px;background:#111;color:#eee}}input{{font-size:16px;padding:8px;width:min(400px,100%)}}
main{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:14px}}
video{{width:100%;aspect-ratio:9/16;background:#000;border-radius:6px}}figure{{margin:0}}figcaption{{margin-top:4px}}</style>
<h1>Vídeos de Saúde: {len(itens)} cidades</h1><input placeholder="buscar cidade" oninput="for(const f of document.querySelectorAll('figure'))f.hidden=!f.dataset.n.includes(this.value.toLowerCase())">
<main>{''.join(itens)}</main>""", encoding="utf-8")
print(len(itens), "vídeos em saida/videos.html")
