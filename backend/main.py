from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from config import settings
from routers.dashboard import router as dashboard_router
from routers.trip_parser import router as trip_parser_router
from routers.group_invitations import router as group_invitations_router
from routers.profile import router as profile_router
from routers.travel_risk import router as travel_risk_router
from routers.blast_radius import router as blast_radius_router
from routers.news import router as news_router
from routers.social_signals import router as social_signals_router
from routers.ai import router as ai_router

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
app.include_router(trip_parser_router)
app.include_router(group_invitations_router)
app.include_router(profile_router)
app.include_router(travel_risk_router)
app.include_router(blast_radius_router)
app.include_router(news_router)
app.include_router(social_signals_router)
app.include_router(ai_router)

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
