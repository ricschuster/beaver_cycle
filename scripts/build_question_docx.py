#!/usr/bin/env python3
"""Build a printable Word handout from a questions markdown file.

Usage: build_question_docx.py QUESTIONS.md OUT.docx TEMPLATE.docx

The markdown has a "# Title" line, an intro paragraph, "## Section" headings,
and question bullets written as "- **Q13.** text" (continuation lines indented).
TEMPLATE.docx is an existing handout whose styles and footer are reused, for
example docs/design/02_game_questions_round1.docx. Each question is followed by
two ruled answer lines.
"""
import re
import sys
import zipfile
from xml.sax.saxutils import escape

FONT = '<w:rFonts w:ascii="Arial" w:cs="Arial" w:eastAsia="Arial" w:hAnsi="Arial"/>'


def run(text, bold=False, size=24):
    b = "<w:b/><w:bCs/>" if bold else ""
    return (f'<w:r><w:rPr>{FONT}{b}<w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>'
            f'<w:t xml:space="preserve">{escape(text, {chr(34): "&quot;"})}</w:t></w:r>')


def title(text):
    return ('<w:p><w:pPr><w:pStyle w:val="Title"/><w:spacing w:after="120"/></w:pPr>'
            + run(text, True, 40) + "</w:p>")


def plain(text, after=120, before=0):
    b = f' w:before="{before}"' if before else ""
    return f'<w:p><w:pPr><w:spacing w:after="{after}"{b}/></w:pPr>{run(text)}</w:p>'


def heading(text):
    return ('<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:keepNext/><w:spacing w:after="80" w:before="360"/></w:pPr>'
            + run(text, True, 30) + "</w:p>")


def question(num, text):
    return ('<w:p><w:pPr><w:keepNext/><w:spacing w:after="0" w:before="240"/><w:ind w:left="360" w:hanging="360"/></w:pPr>'
            + run(f"{num}.  ", True) + run(text) + "</w:p>")


def line(first):
    # Word merges neighbouring paragraphs that have identical borders into one
    # box, so the second line differs by one shade of grey to stay separate.
    kn = "<w:keepNext/>" if first else '<w:keepNext w:val="false"/>'
    color = "555555" if first else "555556"
    return (f'<w:p><w:pPr>{kn}<w:keepLines/><w:pBdr><w:bottom w:val="single" w:color="{color}" w:sz="6" w:space="1"/></w:pBdr>'
            '<w:spacing w:after="0" w:before="0" w:line="560" w:lineRule="exact"/></w:pPr></w:p>')


def parse(md):
    blocks, intro, cur = [], [], None
    for raw in md.splitlines():
        if raw.startswith("# "):
            blocks.append(("title", raw[2:].strip()))
        elif raw.startswith("## "):
            if intro:
                blocks.append(("intro", " ".join(intro)))
                intro = []
            blocks.append(("heading", raw[3:].strip()))
            cur = None
        elif raw.startswith("- "):
            m = re.match(r"- \*\*Q(\d+)\.\*\*\s*(.*)", raw)
            if not m:
                raise SystemExit(f"Unrecognised bullet: {raw}")
            cur = [m.group(1), m.group(2).strip()]
            blocks.append(("q", cur))
        elif raw.strip() and cur is not None:
            cur[1] += " " + raw.strip()
        elif raw.strip():
            intro.append(raw.strip())
    return blocks


def build(blocks):
    out = []
    for kind, val in blocks:
        if kind == "title":
            out += [title(val), plain("Name: ______________________________     Date: ______________", 200, 120)]
        elif kind == "intro":
            out.append(plain(val))
        elif kind == "heading":
            out.append(heading(val))
        else:
            out += [question(val[0], val[1]), line(True), line(False)]
    return "".join(out)


def main(md_path, out_path, template_path):
    blocks = parse(open(md_path, encoding="utf-8").read())
    with zipfile.ZipFile(template_path) as zin:
        doc = zin.read("word/document.xml").decode("utf-8")
        head = doc[: doc.index("<w:body>") + len("<w:body>")]
        sect = doc[doc.index("<w:sectPr>"):]
        with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "word/document.xml":
                    data = (head + build(blocks) + sect).encode("utf-8")
                zout.writestr(item, data)
    print(f"{out_path}: {sum(1 for k, _ in blocks if k == 'q')} questions")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
