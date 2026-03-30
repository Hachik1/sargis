from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from sargis.core import Config, SargisTutor


BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
app = FastAPI(title="S.A.R.G.I.S Mini App")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

config = Config()
tutor = SargisTutor(config)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "webapp_title": "S.A.R.G.I.S Mini App",
            "ollama_model": config.ollama_model,
        },
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": config.ollama_model}


@app.get("/api/profile/{user_id}")
async def get_profile(user_id: int, name: str = Query("Ученик")):
    return tutor.get_profile_summary(user_id, name)


@app.get("/api/practice/{user_id}")
async def get_practice(user_id: int, name: str = Query("Ученик"), topic: Optional[str] = Query(None)):
    return tutor.generate_practice(user_id, name, topic)


@app.post("/api/check/{user_id}")
async def check_answer(
    user_id: int,
    payload: dict,
    name: str = Query("Ученик"),
):
    required = {"topic", "difficulty", "question", "expected_answer", "user_answer"}
    if not required.issubset(payload):
        raise HTTPException(status_code=400, detail="Недостаточно данных для проверки.")

    return tutor.check_practice_answer(
        user_id=user_id,
        user_name=name,
        topic=str(payload["topic"]),
        difficulty=str(payload["difficulty"]),
        question=str(payload["question"]),
        expected_answer=str(payload["expected_answer"]),
        user_answer=str(payload["user_answer"]),
    )
