import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://your-project-id.supabase.co")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173").split(",")
    ]
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    AVIATIONSTACK_API_KEY: str = os.getenv("AVIATIONSTACK_API_KEY", "")
    OPENROUTE_API_KEY: str = os.getenv("OPENROUTE_API_KEY", "")
    NEWS_PROVIDER: str = os.getenv("NEWS_PROVIDER", "newsdata")
    NEWS_API_KEY: str = os.getenv("NEWS_API_KEY", "")
    GNEWS_API_KEY: str = os.getenv("GNEWS_API_KEY", "")
    NEWSDATA_API_KEY: str = os.getenv("NEWSDATA_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_PRIMARY_MODEL: str = os.getenv("GROQ_PRIMARY_MODEL", "openai/gpt-oss-120b")
    GROQ_FALLBACK_MODEL: str = os.getenv("GROQ_FALLBACK_MODEL", "openai/gpt-oss-20b")

settings = Settings()

