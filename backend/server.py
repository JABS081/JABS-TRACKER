# Stub backend so the platform's default supervisor config (which always expects
# /app/backend + `uvicorn server:app`) starts cleanly. This project has no real
# backend -- JABS Tracker's server-side logic runs as Vercel serverless functions
# in /app/api, and its database is Supabase, not this pod's Mongo. This process
# is not used by the app; it exists only to prevent a supervisor FATAL loop.
from fastapi import FastAPI

app = FastAPI()


@app.get("/api/health")
async def health():
    return {"status": "unused", "note": "this project's backend runs on Vercel serverless functions"}
