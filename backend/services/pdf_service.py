import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_pdf_semaphore = asyncio.Semaphore(1)


async def convert_to_pdf(docx_path: Path, output_dir: Path) -> Path:
    """Convert a DOCX file to PDF using LibreOffice headless.

    Uses a semaphore to prevent concurrent LibreOffice instances
    (they share a profile lock and will fail if run simultaneously).
    """
    async with _pdf_semaphore:
        process = await asyncio.create_subprocess_exec(
            "libreoffice",
            "--headless",
            "--convert-to", "pdf",
            "--outdir", str(output_dir),
            str(docx_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=30
            )
        except asyncio.TimeoutError:
            process.kill()
            raise RuntimeError("PDF conversion timed out after 30 seconds")

        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            logger.error("PDF conversion failed: %s", error_msg)
            raise RuntimeError(f"PDF conversion failed: {error_msg}")

    pdf_path = output_dir / docx_path.with_suffix(".pdf").name
    if not pdf_path.exists():
        raise RuntimeError(f"PDF file not created at {pdf_path}")

    return pdf_path
