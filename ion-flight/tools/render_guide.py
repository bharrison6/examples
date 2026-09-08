"""Render Ion Flight's canonical HTML guide as a readable two-page PDF.

The extractor intentionally understands only the semantic elements used in the
checked-in guide. Text, tables, links, and page-break intent stay in the HTML.
"""
from __future__ import annotations

import argparse
import html
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


NAVY = colors.HexColor("#002144")
GOLD = colors.HexColor("#ECAC00")
SKY = colors.HexColor("#00A4E3")
INK = colors.HexColor("#172B42")
MUTED = colors.HexColor("#526A7E")
WASH = colors.HexColor("#EEF8FC")
WARNING = colors.HexColor("#FFF6D9")
LINE = colors.HexColor("#B8CAD8")


class GuideParser(HTMLParser):
    """Small, failure-forward parser for the guide's established HTML shape."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.subtitle = ""
        self.footer = ""
        self.sections: list[dict[str, Any]] = []
        self.active_section: dict[str, Any] | None = None
        self.current: dict[str, Any] | None = None
        self.table: list[list[str]] | None = None
        self.row: list[str] | None = None
        self.cell: list[str] | None = None
        self.in_header = False
        self.in_footer = False

    @staticmethod
    def attrs_map(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key: value or "" for key, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = self.attrs_map(attrs)
        classes = data.get("class", "")
        if tag == "header":
            self.in_header = True
        elif tag == "footer":
            self.in_footer = True
            self.current = {"tag": "footer", "kind": "footer", "classes": "", "text": "", "section": None}
        elif tag == "section":
            self.active_section = {"page_break": "page-break" in classes, "blocks": []}
            self.sections.append(self.active_section)
        elif tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
        elif tag == "br" and self.cell is not None:
            self.cell.append("<br/>")
        elif tag in ("h1", "h2", "h3", "p", "li") or (tag == "div" and ("box" in classes or "formula" in classes)):
            kind = "box" if tag == "div" and "box" in classes else ("formula" if tag == "div" else tag)
            self.current = {"tag": tag, "kind": kind, "classes": classes, "text": "", "section": self.active_section}
            if self.active_section is not None:
                self.active_section["blocks"].append(self.current)
        elif self.current is not None:
            opening = {"strong": "<b>", "b": "<b>", "em": "<i>", "i": "<i>", "code": '<font name="Courier">'}.get(tag)
            if opening:
                self.current["text"] += opening
            elif tag == "a":
                self.current["text"] += '<link href="' + html.escape(data.get("href", ""), quote=True) + '">'
            elif tag == "br":
                self.current["text"] += "<br/>"

    def handle_endtag(self, tag: str) -> None:
        if tag == "header":
            self.in_header = False
        elif tag == "footer" and self.current is not None and self.current["tag"] == "footer":
            self.footer = plain_text(self.current["text"])
            self.current = None
            self.in_footer = False
        elif tag == "section":
            self.active_section = None
        elif tag == "table":
            if self.active_section is None or self.table is None:
                raise ValueError("A table must occur inside a guide section.")
            self.active_section["blocks"].append({"kind": "table", "rows": self.table})
            self.table = None
        elif tag == "tr" and self.table is not None and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.row.append("".join(self.cell).strip())
            self.cell = None
        elif self.current is not None and tag == self.current["tag"]:
            current = self.current
            text = current["text"].strip()
            if current["section"] is None:
                plain = plain_text(text)
                if current["tag"] == "h1":
                    self.title = plain
                elif current["tag"] == "p" and self.in_header:
                    self.subtitle = plain
                elif current["tag"] == "p":
                    self.footer = plain
            self.current = None
        elif self.current is not None:
            closing = {"strong": "</b>", "b": "</b>", "em": "</i>", "i": "</i>", "code": "</font>", "a": "</link>"}.get(tag)
            if closing:
                self.current["text"] += closing

    def handle_data(self, data: str) -> None:
        # ReportLab's Helvetica lacks a reliable gear; preserve its control meaning.
        data = data.replace("⚙", "Settings").replace("σ", "sigma").replace("·", " * ")
        if self.cell is not None:
            self.cell.append(data)
        elif self.current is not None:
            self.current["text"] += html.escape(data)


def plain_text(value: str) -> str:
    replacements = {"<b>": "", "</b>": "", "<i>": "", "</i>": "", "<br/>": " ", '<font name="Courier">': "", "</font>": ""}
    for old, new in replacements.items():
        value = value.replace(old, new)
    return " ".join(html.unescape(value).split())


def styles() -> dict[str, ParagraphStyle]:
    return {
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.3, leading=11.3, textColor=INK, spaceAfter=3),
        "lead": ParagraphStyle("lead", fontName="Helvetica", fontSize=10.0, leading=12.0, textColor=INK, spaceAfter=4),
        "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.2, leading=9.7, textColor=MUTED, spaceAfter=3),
        "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12.4, leading=14.2, textColor=NAVY, spaceBefore=7, spaceAfter=3),
        "h3": ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=10.2, leading=11.8, textColor=colors.HexColor("#006A98"), spaceBefore=5, spaceAfter=2),
        "list": ParagraphStyle("list", fontName="Helvetica", fontSize=9.2, leading=10.9, textColor=INK, leftIndent=13, firstLineIndent=-10, spaceAfter=1),
        "box": ParagraphStyle("box", fontName="Helvetica", fontSize=9.1, leading=10.9, textColor=INK, leftIndent=8, rightIndent=7),
        "formula": ParagraphStyle("formula", fontName="Helvetica-Bold", fontSize=12.0, leading=14.2, textColor=colors.white, alignment=1),
        "table_head": ParagraphStyle("table_head", fontName="Helvetica-Bold", fontSize=7.7, leading=8.8, textColor=colors.white),
        "table_cell": ParagraphStyle("table_cell", fontName="Helvetica", fontSize=8.15, leading=9.45, textColor=INK),
    }


def formula_fallback(value: str) -> str:
    """Keep the canonical formula's meaning with characters safe in base PDF fonts."""
    return value.replace("½", "1/2").replace("²", "^2").replace("→", "-&gt;").replace("√", "sqrt")


def render_table(rows: list[list[str]], width: float, style_set: dict[str, ParagraphStyle]) -> Table:
    if not rows or any(len(row) != len(rows[0]) for row in rows):
        raise ValueError("Guide table is malformed.")
    rendered = [
        [Paragraph(cell, style_set["table_head"] if row_index == 0 else style_set["table_cell"]) for cell in row]
        for row_index, row in enumerate(rows)
    ]
    column_count = len(rows[0])
    table = Table(rendered, colWidths=[width / column_count] * column_count, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table


def flowables(block: dict[str, Any], style_set: dict[str, ParagraphStyle], width: float) -> list[Any]:
    kind = block["kind"]
    if kind == "table":
        return [Spacer(1, 2), render_table(block["rows"], width, style_set), Spacer(1, 5)]
    if kind == "box":
        box = Table([[Paragraph(block["text"], style_set["box"])]], colWidths=[width])
        background = WARNING if "warning" in block.get("classes", "") else WASH
        accent = GOLD if "warning" in block.get("classes", "") else SKY
        box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), background), ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
            ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        return [Spacer(1, 2), box, Spacer(1, 5)]
    if kind == "formula":
        formula = Table([[Paragraph(formula_fallback(block["text"]), style_set["formula"])]], colWidths=[width])
        formula.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), NAVY), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
        return [Spacer(1, 2), formula, Spacer(1, 5)]
    if kind == "li":
        return [Paragraph("- " + block["text"], style_set["list"])]
    if kind == "p":
        style = style_set["lead"] if "lead" in block.get("classes", "") else (style_set["small"] if "small" in block.get("classes", "") else style_set["body"])
        return [Paragraph(block["text"], style)]
    return [Paragraph(block["text"], style_set[kind])]


def page_decor(canvas: Any, document: Any, title: str, footer: str) -> None:
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 6, width, 6, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(document.leftMargin, height - 23, title)
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1.8)
    canvas.line(document.leftMargin, height - 28, width - document.rightMargin, height - 28)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.45)
    canvas.line(document.leftMargin, 34, width - document.rightMargin, 34)
    footer = footer.replace("This HTML file is the canonical guide source.", "Canonical guide source: teacher-guide.html")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 6.3)
    canvas.drawString(document.leftMargin, 22, footer)
    canvas.drawRightString(width - document.rightMargin, 12, f"Page {document.page}")
    canvas.restoreState()


def render(source: Path, destination: Path) -> None:
    parser = GuideParser()
    parser.feed(source.read_text(encoding="utf-8"))
    parser.close()
    if not parser.title or not parser.subtitle or not parser.footer or len(parser.sections) < 2:
        raise ValueError("Teacher guide is missing its header, footer, or semantic sections.")
    if any(not section["blocks"] for section in parser.sections):
        raise ValueError("Teacher guide contains an empty section.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(str(destination), pagesize=letter, leftMargin=.55 * inch, rightMargin=.55 * inch, topMargin=.60 * inch, bottomMargin=.58 * inch, title=parser.title + " — Teacher Guide", author="Bryant Harrison · Murray State University", subject="Printable guide for the Ion Flight classroom activity")
    style_set = styles()
    story: list[Any] = [Paragraph(parser.title, ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=22, leading=25, textColor=NAVY, spaceAfter=3)), Paragraph(parser.subtitle, ParagraphStyle("subtitle", fontName="Helvetica", fontSize=9.8, leading=12, textColor=MUTED, spaceAfter=6))]
    for index, section in enumerate(parser.sections):
        if section["page_break"]:
            story.append(PageBreak())
        elif index:
            story.append(Spacer(1, 2))
        for block in section["blocks"]:
            story.extend(flowables(block, style_set, document.width))
    document.build(story, onFirstPage=lambda c, d: page_decor(c, d, parser.title, parser.footer), onLaterPages=lambda c, d: page_decor(c, d, parser.title, parser.footer))


def main() -> None:
    arguments = argparse.ArgumentParser(description=__doc__)
    root = Path(__file__).resolve().parents[1]
    arguments.add_argument("--source", type=Path, default=root / "teacher-guide.html")
    arguments.add_argument("--output", type=Path, default=root / "teacher-guide.pdf")
    args = arguments.parse_args()
    render(args.source, args.output)
    print(f"Rendered {args.output} from canonical {args.source}")


if __name__ == "__main__":
    main()
