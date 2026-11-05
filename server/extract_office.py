"""Extract text from OOXML documents with only Python's standard library.

This intentionally handles modern .docx and .pptx files. Legacy binary .doc/.ppt
files remain preserved as uploads, but need a desktop conversion service before
their contents can be read reliably.
"""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree


WORD = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
DRAWING = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


def docx_text(archive: zipfile.ZipFile) -> tuple[str, int | None]:
    root = ElementTree.fromstring(archive.read("word/document.xml"))
    paragraphs = []
    for paragraph in root.iter(f"{WORD}p"):
        line = "".join(node.text or "" for node in paragraph.iter(f"{WORD}t")).strip()
        if line:
            paragraphs.append(line)
    return "\n".join(paragraphs), None


def pptx_text(archive: zipfile.ZipFile) -> tuple[str, int]:
    slide_names = sorted(
        name for name in archive.namelist()
        if name.startswith("ppt/slides/slide") and name.endswith(".xml")
    )
    slides = []
    for position, name in enumerate(slide_names, start=1):
        root = ElementTree.fromstring(archive.read(name))
        text = "\n".join((node.text or "").strip() for node in root.iter(f"{DRAWING}t") if (node.text or "").strip())
        if text:
            slides.append(f"第 {position} 页\n{text}")
    return "\n\n".join(slides), len(slide_names)


def main() -> None:
    path = Path(sys.argv[1])
    extension = path.suffix.lower()
    try:
        with zipfile.ZipFile(path) as archive:
            if extension == ".docx":
                text, page_count = docx_text(archive)
                parser = "DOCX 文本提取"
            elif extension == ".pptx":
                text, page_count = pptx_text(archive)
                parser = "PPTX 幻灯片提取"
            else:
                raise ValueError("仅支持 DOCX 或 PPTX")
        print(json.dumps({"text": text, "page_count": page_count, "parser": parser}, ensure_ascii=False))
    except Exception as error:  # Keep a useful error at the Node API boundary.
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
