"""PDF report generation for Meridian engagement assessments."""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)


# Color scheme matching the app
INDIGO = colors.HexColor("#4F46E5")
INDIGO_LIGHT = colors.HexColor("#EEF2FF")
GRAY_800 = colors.HexColor("#1F2937")
GRAY_600 = colors.HexColor("#4B5563")
GRAY_400 = colors.HexColor("#9CA3AF")
EMERALD = colors.HexColor("#059669")
AMBER = colors.HexColor("#D97706")
RED = colors.HexColor("#DC2626")
WHITE = colors.white

RATING_COLORS = {
    "excelling": colors.HexColor("#059669"),
    "meeting_expectations": colors.HexColor("#2563EB"),
    "developing": colors.HexColor("#D97706"),
    "needs_improvement": colors.HexColor("#DC2626"),
    "not_rated": colors.HexColor("#9CA3AF"),
}

RATING_LABELS = {
    "excelling": "Excelling",
    "meeting_expectations": "Meeting Expectations",
    "developing": "Developing",
    "needs_improvement": "Needs Improvement",
    "not_rated": "Not Rated",
}


def _build_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=24,
        textColor=GRAY_800,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=GRAY_400,
        spaceAfter=20,
    ))
    styles.add(ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=INDIGO,
        spaceBefore=18,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "SubHeading",
        parent=styles["Heading3"],
        fontSize=11,
        textColor=GRAY_800,
        spaceBefore=10,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontSize=9.5,
        textColor=GRAY_600,
        leading=13,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "BulletText",
        parent=styles["Normal"],
        fontSize=9,
        textColor=GRAY_600,
        leading=12,
        leftIndent=12,
        bulletIndent=0,
    ))
    return styles


def generate_assessment_pdf(
    school_name: str,
    engagement_name: str,
    dimensions: list,
    scores: list,
    dim_summaries: list,
    global_summary: dict | None,
    action_items: list,
) -> bytes:
    """Generate a professional PDF report of the assessment."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )
    styles = _build_styles()
    story = []

    # --- Title Page ---
    story.append(Spacer(1, 1.5 * inch))
    story.append(Paragraph("Meridian Assessment Report", styles["ReportTitle"]))
    story.append(Paragraph(school_name, ParagraphStyle(
        "SchoolName", parent=styles["ReportTitle"], fontSize=18, textColor=INDIGO,
    )))
    story.append(Spacer(1, 12))
    story.append(Paragraph(engagement_name, styles["ReportSubtitle"]))
    story.append(Paragraph(f"Generated {datetime.now().strftime('%B %d, %Y')}", styles["ReportSubtitle"]))
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=1, color=INDIGO, spaceAfter=12))

    # Rating legend
    legend_data = [[
        Paragraph(f'<font color="{RATING_COLORS[r].hexval()}">{RATING_LABELS[r]}</font>', styles["ReportBody"])
        for r in ["excelling", "meeting_expectations", "developing", "needs_improvement"]
    ]]
    legend_table = Table(legend_data, colWidths=[1.6 * inch] * 4)
    legend_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(legend_table)

    # --- Executive Summary ---
    if global_summary:
        story.append(Paragraph("Executive Summary", styles["SectionHeading"]))
        exec_text = global_summary.get("executive_summary", "")
        if exec_text:
            for para in exec_text.split("\n\n"):
                if para.strip():
                    story.append(Paragraph(para.strip(), styles["ReportBody"]))

        for section_key, section_title in [
            ("top_strengths", "Key Strengths"),
            ("critical_gaps", "Critical Gaps"),
            ("strategic_priorities", "Strategic Priorities"),
        ]:
            items = global_summary.get(section_key, [])
            if items:
                story.append(Paragraph(section_title, styles["SubHeading"]))
                for item in items:
                    story.append(Paragraph(f"\u2022 {item}", styles["BulletText"]))

    # --- Component Scores Table ---
    score_map = {s.get("component_id", ""): s for s in scores}
    dim_map = {}
    for d in dimensions:
        dim_map[d["id"]] = d

    story.append(Paragraph("Component Assessment Overview", styles["SectionHeading"]))

    table_data = [["Code", "Component", "Dimension", "Rating", "Confidence"]]
    for dim in sorted(dimensions, key=lambda d: d.get("number", 0)):
        for comp in dim.get("components", []):
            sc = score_map.get(comp["id"], {})
            rating = sc.get("rating", "not_rated")
            confidence = sc.get("confidence", "-")
            rating_label = RATING_LABELS.get(rating, rating)
            rc = RATING_COLORS.get(rating, GRAY_400)
            table_data.append([
                comp.get("code", ""),
                Paragraph(comp.get("name", ""), styles["ReportBody"]),
                dim.get("name", ""),
                Paragraph(f'<font color="{rc.hexval()}">{rating_label}</font>', styles["ReportBody"]),
                confidence if confidence != "-" else "",
            ])

    if len(table_data) > 1:
        col_widths = [0.5 * inch, 2.2 * inch, 1.6 * inch, 1.4 * inch, 0.8 * inch]
        t = Table(table_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, INDIGO_LIGHT]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)

    # --- Dimension Summaries ---
    if dim_summaries:
        story.append(Paragraph("Dimension Analysis", styles["SectionHeading"]))
        ds_map = {ds.get("dimension_id", ""): ds for ds in dim_summaries}
        for dim in sorted(dimensions, key=lambda d: d.get("number", 0)):
            ds = ds_map.get(dim["id"])
            if not ds:
                continue
            story.append(KeepTogether([
                Paragraph(f"{dim.get('number', '')}. {dim.get('name', '')}", styles["SubHeading"]),
                Paragraph(ds.get("overall_assessment", "No synthesis available."), styles["ReportBody"]),
            ]))
            for key, title in [("patterns", "Patterns"), ("top_opportunities", "Opportunities")]:
                items = ds.get(key, [])
                if items:
                    story.append(Paragraph(title, ParagraphStyle(
                        "MiniHead", parent=styles["ReportBody"], fontName="Helvetica-Bold", fontSize=9,
                    )))
                    for item in items:
                        story.append(Paragraph(f"\u2022 {item}", styles["BulletText"]))

    # --- Action Plan ---
    if action_items:
        story.append(Paragraph("Action Plan", styles["SectionHeading"]))
        for i, item in enumerate(action_items, 1):
            status_str = item.get("status", "not_started").replace("_", " ").title()
            elems = [
                Paragraph(f"<b>{i}. {item.get('title', '')}</b> <font color='#9CA3AF'>({status_str})</font>", styles["ReportBody"]),
            ]
            if item.get("description"):
                elems.append(Paragraph(item["description"], styles["BulletText"]))
            if item.get("rationale"):
                elems.append(Paragraph(f"<i>Rationale: {item['rationale']}</i>", ParagraphStyle(
                    "Rationale", parent=styles["BulletText"], textColor=GRAY_400, fontSize=8,
                )))
            if item.get("owner"):
                elems.append(Paragraph(f"Owner: {item['owner']}", ParagraphStyle(
                    "Owner", parent=styles["BulletText"], fontSize=8, textColor=GRAY_400,
                )))
            story.append(KeepTogether(elems))
            story.append(Spacer(1, 4))

    # --- Footer ---
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_400, spaceAfter=8))
    story.append(Paragraph(
        "Generated by Meridian \u2014 Bellwether School Quality Assessment Platform",
        ParagraphStyle("Footer", parent=styles["ReportBody"], fontSize=8, textColor=GRAY_400, alignment=1),
    ))

    doc.build(story)
    return buf.getvalue()
