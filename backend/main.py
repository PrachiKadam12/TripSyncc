from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from config import settings
from routers.dashboard import router as dashboard_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tripsync.api")

app = FastAPI(
    title="TripSync API",
    description="FastAPI Backend for Travel Disruption Recovery & Intelligent Travel Resilience",
    version="1.0.0"
)

# Enable CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(dashboard_router)

@app.get("/")
def read_root():
    return {
        "app": "TripSync API",
        "status": "healthy",
        "docs": "/docs",
        "environment": settings.ENVIRONMENT
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
