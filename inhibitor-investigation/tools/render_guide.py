"""Render the canonical teacher-guide.html as a one-page, two-column PDF.

Only Python's standard-library HTMLParser is used to extract the guide content;
the prose, table values, and source links remain authored in teacher-guide.html.
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
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import Paragraph, Table, TableStyle


NAVY = colors.HexColor("#002144")
GOLD = colors.HexColor("#ECAC00")
LITE_BLUE = colors.HexColor("#00A4E3")
INK = colors.HexColor("#162535")
MUTED = colors.HexColor("#526575")
WASH = colors.HexColor("#F1F8FC")
LINE = colors.HexColor("#B8CAD8")


class GuideParser(HTMLParser):
    """A deliberately narrow parser for the checked-in guide's semantic HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.subtitle = ""
        self.footer = ""
        self.sections: list[list[dict[str, Any]]] = []
        self.active_section: list[dict[str, Any]] | None = None
        self.current: dict[str, Any] | None = None
        self.list_stack: list[str] = []
        self.table: list[list[str]] | None = None
        self.row: list[str] | None = None
        self.cell: list[str] | None = None
        self.in_header = False

    @staticmethod
    def attrs_map(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key: value or "" for key, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = self.attrs_map(attrs)
        if tag == "header":
            self.in_header = True
        elif tag == "section":
            self.active_section = []
            self.sections.append(self.active_section)
        elif tag in ("ol", "ul"):
            self.list_stack.append(tag)
        elif tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
        elif tag in ("h1", "h2", "p", "li") or (tag == "div" and "box" in data.get("class", "")):
            kind = "box" if tag == "div" else tag
            self.current = {"tag": tag, "kind": kind, "text": "", "section": self.active_section}
            if self.active_section is not None:
                self.active_section.append(self.current)
        elif self.current is not None:
            if tag == "strong":
                self.current["text"] += "<b>"
            elif tag == "em":
                self.current["text"] += "<i>"
            elif tag == "code":
                self.current["text"] += '<font name="Courier">'
            elif tag == "a":
                self.current["text"] += '<link href="' + html.escape(data.get("href", ""), quote=True) + '">'
            elif tag == "br":
                self.current["text"] += "<br/>"

    def handle_endtag(self, tag: str) -> None:
        if tag == "header":
            self.in_header = False
        elif tag == "section":
            self.active_section = None
        elif tag in ("ol", "ul") and self.list_stack:
            self.list_stack.pop()
        elif tag == "table":
            if self.active_section is None or self.table is None:
                raise ValueError("Guide table occurs outside a content section.")
            self.active_section.append({"kind": "table", "rows": self.table})
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
                if current["tag"] == "h1":
                    self.title = strip_markup(text)
                elif current["tag"] == "p" and self.in_header:
                    self.subtitle = strip_markup(text)
                elif current["tag"] == "p":
                    self.footer = strip_markup(text)
            elif current["tag"] == "li":
                current["kind"] = "list"
            self.current = None
        elif self.current is not None:
            closing = {"strong": "</b>", "em": "</i>", "code": "</font>", "a": "</link>"}.get(tag)
            if closing:
                self.current["text"] += closing

    def handle_data(self, data: str) -> None:
        # Helvetica has no reliable gear glyph; preserve the control's meaning in print.
        data = data.replace("⚙", "Settings")
        if self.cell is not None:
            self.cell.append(data)
        elif self.current is not None:
            self.current["text"] += html.escape(data)


def strip_markup(value: str) -> str:
    return " ".join(html.unescape(value).replace("<b>", "").replace("</b>", "").replace("<i>", "").replace("</i>", "").replace("<br/>", " ").split())


def paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def guide_styles() -> dict[str, ParagraphStyle]:
    return {
        "heading": ParagraphStyle("heading", fontName="Helvetica-Bold", fontSize=9.4, leading=11.2, textColor=NAVY, spaceBefore=6, spaceAfter=2),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=7.45, leading=9.0, textColor=INK, spaceAfter=3),
        "box": ParagraphStyle("box", fontName="Helvetica", fontSize=7.3, leading=8.8, textColor=INK, leftIndent=5, rightIndent=4),
        "list": ParagraphStyle("list", fontName="Helvetica", fontSize=7.35, leading=8.7, textColor=INK, leftIndent=8, firstLineIndent=-7, bulletIndent=0, spaceAfter=1.4),
    }


def draw_block(canvas: Any, block: dict[str, Any], x: float, y: float, width: float, styles: dict[str, ParagraphStyle]) -> float:
    kind = block["kind"]
    if kind == "table":
        rows = block["rows"]
        if not rows or any(len(row) != len(rows[0]) for row in rows):
            raise ValueError("Guide table is malformed.")
        header_style = ParagraphStyle("table_header", fontName="Helvetica-Bold", fontSize=6.5, leading=7.4, textColor=colors.white)
        cell_style = ParagraphStyle("table_cell", fontName="Helvetica", fontSize=6.6, leading=7.7, textColor=INK)
        formatted_rows = [
            [Paragraph(html.escape(cell), header_style if row_index == 0 else cell_style) for cell in row]
            for row_index, row in enumerate(rows)
        ]
        table = Table(formatted_rows, colWidths=[width / len(rows[0])] * len(rows[0]), repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 6.8), ("LEADING", (0, 0), (-1, -1), 8.1),
            ("GRID", (0, 0), (-1, -1), 0.35, LINE), ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        _, height = table.wrap(width, y)
        y -= height
        table.drawOn(canvas, x, y)
        return y - 5
    style_name = "heading" if kind == "h2" else ("box" if kind == "box" else ("list" if kind == "list" else "body"))
    text = block["text"]
    if kind == "list":
        text = "• " + text
    flowable = paragraph(text, styles[style_name])
    _, height = flowable.wrap(width, y)
    if kind == "box":
        box_height = height + 9
        y -= box_height
        canvas.setFillColor(WASH)
        canvas.rect(x, y, width, box_height, fill=1, stroke=0)
        canvas.setFillColor(LITE_BLUE)
        canvas.rect(x, y, 3, box_height, fill=1, stroke=0)
        flowable.drawOn(canvas, x + 5, y + 4)
        return y - 4
    y -= height
    flowable.drawOn(canvas, x, y)
    return y - (2 if kind == "h2" else 1)


def render(source: Path, destination: Path) -> None:
    parser = GuideParser()
    parser.feed(source.read_text(encoding="utf-8"))
    parser.close()
    if not parser.title or len(parser.sections) != 2 or not parser.footer:
        raise ValueError("Expected a title, footer, and exactly two content sections in teacher-guide.html.")
    if any(not section for section in parser.sections):
        raise ValueError("Teacher guide has an empty content section.")

    width, height = letter
    margin = 30
    gutter = 16
    column_width = (width - margin * 2 - gutter) / 2
    content_top = height - 88
    footer_y = 24
    destination.parent.mkdir(parents=True, exist_ok=True)
    from reportlab.pdfgen import canvas as canvas_module
    pdf = canvas_module.Canvas(str(destination), pagesize=letter, pageCompression=1)
    pdf.setTitle(parser.title + " — Teacher Guide")
    pdf.setAuthor("Bryant Harrison · Murray State University")
    pdf.setSubject("Printable guide for the Inhibitor Investigation classroom activity")

    pdf.setFillColor(NAVY)
    pdf.rect(0, height - 7, width, 7, fill=1, stroke=0)
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(margin, height - 33, parser.title)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 8.4)
    pdf.drawString(margin, height - 47, parser.subtitle)
    pdf.setFillColor(GOLD)
    pdf.rect(margin, height - 56, width - margin * 2, 3, fill=1, stroke=0)

    styles = guide_styles()
    positions = [margin, margin + column_width + gutter]
    for section, x in zip(parser.sections, positions):
        y = content_top
        for block in section:
            y = draw_block(pdf, block, x, y, column_width, styles)
            if y < footer_y + 18:
                raise ValueError("Teacher guide does not fit on one page; shorten canonical HTML or adjust layout.")
    pdf.setStrokeColor(LINE)
    pdf.line(margin, 36, width - margin, 36)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 6.5)
    pdf.drawString(margin, 25, parser.footer)
    pdf.showPage()
    pdf.save()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1] / "teacher-guide.html")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "teacher-guide.pdf")
    args = parser.parse_args()
    render(args.source, args.output)
    print(f"Rendered {args.output} from canonical {args.source}")


if __name__ == "__main__":
    main()
