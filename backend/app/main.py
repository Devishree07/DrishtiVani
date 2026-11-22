from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.transcription_routes import router as transcription_router

app = FastAPI(
    title="DrishtiVani API",
    description="Localized AI/ML platform for accessible document and math transcription",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcription_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "DrishtiVani Backend is running successfully!"}