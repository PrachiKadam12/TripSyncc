import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from services.pdf_extractor import extract_pdf_content, extract_trip_with_gemini

logger = logging.getLogger("tripsync.router.trip_parser")
router = APIRouter(prefix="/api/trips", tags=["Trip Parser"])

MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024  # 4 MB

@router.post("/parse-plan")
async def parse_trip_plan(file: UploadFile = File(...)):
    """
    Parse an uploaded Trip Plan PDF:
    1. Validates PDF format and 4 MB maximum size.
    2. Extracts text using PyMuPDF.
    3. If scanned/image-based, triggers OCR page rendering.
    4. Sends extracted content to Gemini to extract structured trip details.
    """
    filename = file.filename or "unknown.pdf"
    content_type = file.content_type or ""

    # Validate file type
    if not filename.lower().endswith(".pdf") and content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a PDF file."
        )

    # Read binary contents
    try:
        contents = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to read the uploaded file. Please try again."
        )

    # Validate file size (4 MB limit)
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be 4 MB or less."
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF file is empty."
        )

    try:
        # Step 1 & 2: Extract text or render page images for OCR
        text, is_scanned, page_images = extract_pdf_content(contents)
        
        # Step 3 & 4: Call Gemini for structured data extraction
        trip_data = await extract_trip_with_gemini(text, is_scanned, page_images)

        return {
            "success": True,
            "filename": filename,
            "size_bytes": len(contents),
            "is_scanned": is_scanned,
            "data": trip_data
        }
    except ValueError as ve:
        logger.warning(f"Validation error parsing PDF {filename}: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Error processing trip plan PDF with Gemini: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to extract trip details from this PDF. You can enter the details manually."
        )
