
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="STT Gemini Voice Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://micky-ai-nu.vercel.app",
        "https://micky-odsj7jii37-ankit-kumars-projects-467940b2.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PromptRequest(BaseModel):
    text: str
    language: Optional[str] = None


@app.get("/")
def health_check():
    return {"status": "running"}


@app.post("/api/gemini-response")
def get_gemini_response(payload: PromptRequest):
    user_text = payload.text.strip()

    if not user_text:
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty.",
        )

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY missing in .env",
        )

    try:
        client = genai.Client(api_key=api_key)

        language_instruction = {
            "en": "Respond in clear, cheerful English.",
            "hi": "Respond in natural, sweet Hindi using Devanagari script.",
            "hinglish": "Respond naturally in Hinglish, preserving the user's Hindi and English mix.",
        }.get(
            payload.language,
            "Detect the language of this message and respond in that same language.",
        )

        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=f"""
            You are Micky (Mickey), a cheerful, warm, and friendly Disney-style AI buddy.
            Respond in 1-2 simple, clear, lively sentences.

                LANGUAGE MATCHING:
                The frontend classification for this message is: {payload.language or "unknown"}.
                {language_instruction}
                Re-evaluate the current message on every request. Do not default to Hindi, translate unnecessarily,
                or use the previous turn's language when this message clearly switches languages.
                If the message is a natural Hindi and English mix, keep the response naturally mixed.
                Keep sentences short, sweet, conversational, and easy to pronounce.

            User question:
            {user_text}
            """,
        )

        return {
            "success": True,
            "response": response.text or "",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {str(e)}",
        )
