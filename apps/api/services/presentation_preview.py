"""Convert an owned PowerPoint upload into a layout-preserving PDF preview."""

from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def _convert(source: Path, target: Path) -> Path | None:
    soffice = shutil.which("soffice")
    if not soffice:
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and target.stat().st_mtime >= source.stat().st_mtime:
        return target
    with tempfile.TemporaryDirectory(prefix="ppt-preview-") as temporary:
        workdir = Path(temporary)
        result = subprocess.run(
            [soffice, f"-env:UserInstallation=file://{workdir / 'profile'}", "--headless", "--convert-to", "pdf", "--outdir", str(workdir), str(source)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=90,
            check=False,
        )
        converted = workdir / f"{source.stem}.pdf"
        if result.returncode or not converted.is_file() or converted.stat().st_size == 0:
            return None
        staged = target.with_name(f"{target.stem}.{os.getpid()}.tmp")
        shutil.copyfile(converted, staged)
        os.replace(staged, target)
    return target


async def presentation_pdf_preview(source: Path, upload_root: str, job_id: str) -> Path | None:
    target = Path(upload_root).expanduser().resolve() / ".previews" / f"{job_id}.pdf"
    return await asyncio.to_thread(_convert, source, target)
