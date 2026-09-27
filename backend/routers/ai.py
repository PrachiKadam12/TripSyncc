"""
AI Router — backend proxy for Groq/Gemini API calls.
Keeps API keys server-side — browser never sees them.
"""
import os
import logging
import urllib.request
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("tripsync.router.ai")

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_PRIMARY_MODEL = os.getenv("GROQ_PRIMARY_MODEL", "openai/gpt-oss-120b")
GROQ_FALLBACK_MODEL = os.getenv("GROQ_FALLBACK_MODEL", "openai/gpt-oss-20b")
GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"


class AiRequest(BaseModel):
    prompt: str
    max_tokens: int = 800


@router.post("/generate")
async def generate_content(req: AiRequest):
    """
    Generate AI content using Groq (primary/fallback models).
    API key stays server-side.
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured")

    last_error = None
    for model in [GROQ_PRIMARY_MODEL, GROQ_FALLBACK_MODEL]:
        try:
            payload = json.dumps({
                "model": model,
                "messages": [{"role": "user", "content": req.prompt}],
                "temperature": 0.7,
                "max_tokens": req.max_tokens,
            }).encode("utf-8")

            request = urllib.request.Request(
                GROQ_BASE_URL,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                },
            )

            with urllib.request.urlopen(request, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if text:
                return {
                    "text": text.strip(),
                    "model": model,
                    "source": "groq",
                }
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            logger.warning(f"Groq model {model} failed: HTTP {e.code} — {body[:200]}")
            last_error = f"HTTP {e.code}"
            # Don't retry on 401/403 — permanent auth failure
            if e.code in (401, 403):
                break
        except Exception as e:
            logger.warning(f"Groq model {model} failed: {e}")
            last_error = str(e)

    raise HTTPException(status_code=502, detail=f"All Groq models failed. Last error: {last_error}")
