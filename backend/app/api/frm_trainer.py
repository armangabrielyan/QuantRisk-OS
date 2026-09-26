"""QuantRisk OS - FRM Trainer API Router"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from sqlalchemy.orm import Session
import random
from datetime import datetime

from app.database.session import get_db
from app.models.orm_models import FRMQuestion, QuizSession, QuizAttempt

router = APIRouter(prefix="/api/frm-trainer", tags=["FRM Trainer"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class QuizStartRequest(BaseModel):
    n_questions: int = Field(10, ge=1, le=35)
    category: Optional[str] = None
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None
    seed: Optional[int] = None
    session_name: Optional[str] = None


class AnswerSubmitRequest(BaseModel):
    session_id: int
    question_id: int
    selected_answer: Literal["A", "B", "C", "D"]
    time_taken_seconds: Optional[float] = None


class QuizCompleteRequest(BaseModel):
    session_id: int


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/questions")
async def list_questions(
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List FRM questions with optional filters."""
    query = db.query(FRMQuestion)
    if category:
        query = query.filter(FRMQuestion.category.ilike(f"%{category}%"))
    if difficulty:
        query = query.filter(FRMQuestion.difficulty == difficulty.lower())

    questions = query.all()
    return {
        "status": "success",
        "data": {
            "questions": [
                {
                    "id": q.id,
                    "category": q.category,
                    "subcategory": q.subcategory,
                    "difficulty": q.difficulty,
                    "prompt": q.prompt,
                    "option_a": q.option_a,
                    "option_b": q.option_b,
                    "option_c": q.option_c,
                    "option_d": q.option_d,
                    "is_calculation": q.is_calculation,
                    "tags": q.tags,
                }
                for q in questions
            ],
            "total": len(questions),
        },
    }


@router.get("/questions/{question_id}")
async def get_question(question_id: int, db: Session = Depends(get_db)):
    """Get a specific question (without answer for quiz mode)."""
    q = db.query(FRMQuestion).filter(FRMQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {
        "status": "success",
        "data": {
            "id": q.id,
            "category": q.category,
            "subcategory": q.subcategory,
            "difficulty": q.difficulty,
            "prompt": q.prompt,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "formula": q.formula,
            "is_calculation": q.is_calculation,
            "tags": q.tags,
        },
    }


@router.get("/questions/{question_id}/answer")
async def get_question_answer(question_id: int, db: Session = Depends(get_db)):
    """Get the answer and explanation for a question."""
    q = db.query(FRMQuestion).filter(FRMQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {
        "status": "success",
        "data": {
            "id": q.id,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "formula": q.formula,
            "derivation": q.derivation,
            "common_mistake": q.common_mistake,
        },
    }


@router.post("/quiz/start")
async def start_quiz(req: QuizStartRequest, db: Session = Depends(get_db)):
    """Start a new quiz session and return selected questions."""
    query = db.query(FRMQuestion)
    if req.category:
        query = query.filter(FRMQuestion.category.ilike(f"%{req.category}%"))
    if req.difficulty:
        query = query.filter(FRMQuestion.difficulty == req.difficulty)

    all_questions = query.all()
    if not all_questions:
        raise HTTPException(status_code=404, detail="No questions match the filters")

    # Random sample
    rng = random.Random(req.seed)
    n = min(req.n_questions, len(all_questions))
    selected = rng.sample(all_questions, n)

    # Create session
    session = QuizSession(
        session_name=req.session_name or f"Quiz {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
        category_filter=req.category,
        difficulty_filter=req.difficulty,
        total_questions=n,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "status": "success",
        "data": {
            "session_id": session.id,
            "questions": [
                {
                    "id": q.id,
                    "category": q.category,
                    "subcategory": q.subcategory,
                    "difficulty": q.difficulty,
                    "prompt": q.prompt,
                    "option_a": q.option_a,
                    "option_b": q.option_b,
                    "option_c": q.option_c,
                    "option_d": q.option_d,
                    "formula": q.formula,
                    "is_calculation": q.is_calculation,
                    "tags": q.tags,
                }
                for q in selected
            ],
            "n_questions": n,
            "session_name": session.session_name,
        },
    }


@router.post("/quiz/answer")
async def submit_answer(req: AnswerSubmitRequest, db: Session = Depends(get_db)):
    """Submit an answer to a quiz question."""
    session = db.query(QuizSession).filter(QuizSession.id == req.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Quiz session not found")
    if session.completed:
        raise HTTPException(status_code=400, detail="Quiz session already completed")

    question = db.query(FRMQuestion).filter(FRMQuestion.id == req.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    is_correct = req.selected_answer.upper() == question.correct_answer.upper()

    # Check if already answered
    existing = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.session_id == req.session_id,
            QuizAttempt.question_id == req.question_id,
        )
        .first()
    )
    if existing:
        return {
            "status": "success",
            "data": {
                "already_answered": True,
                "is_correct": existing.is_correct,
                "correct_answer": question.correct_answer,
                "explanation": question.explanation,
                "formula": question.formula,
                "derivation": question.derivation,
                "common_mistake": question.common_mistake,
            },
        }

    # Save attempt
    attempt = QuizAttempt(
        session_id=req.session_id,
        question_id=req.question_id,
        selected_answer=req.selected_answer,
        is_correct=is_correct,
        time_taken_seconds=req.time_taken_seconds,
    )
    db.add(attempt)
    db.commit()

    return {
        "status": "success",
        "data": {
            "is_correct": is_correct,
            "selected_answer": req.selected_answer,
            "correct_answer": question.correct_answer,
            "explanation": question.explanation,
            "formula": question.formula,
            "derivation": question.derivation,
            "common_mistake": question.common_mistake,
        },
    }


@router.post("/quiz/complete")
async def complete_quiz(req: QuizCompleteRequest, db: Session = Depends(get_db)):
    """Complete a quiz session and compute final score."""
    session = db.query(QuizSession).filter(QuizSession.id == req.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Quiz session not found")

    attempts = db.query(QuizAttempt).filter(QuizAttempt.session_id == req.session_id).all()
    correct = sum(1 for a in attempts if a.is_correct)
    total = len(attempts)
    score_pct = (correct / total * 100) if total > 0 else 0.0

    session.correct_answers = correct
    session.total_questions = total
    session.score_pct = score_pct
    session.completed = True
    session.completed_at = datetime.utcnow()
    db.commit()

    return {
        "status": "success",
        "data": {
            "session_id": req.session_id,
            "total_questions": total,
            "correct_answers": correct,
            "score_pct": round(score_pct, 1),
            "grade": (
                "Excellent" if score_pct >= 80
                else "Good" if score_pct >= 65
                else "Pass" if score_pct >= 50
                else "Fail"
            ),
        },
    }


@router.get("/history")
async def get_quiz_history(db: Session = Depends(get_db)):
    """Get all completed quiz sessions."""
    sessions = (
        db.query(QuizSession)
        .filter(QuizSession.completed == True)
        .order_by(QuizSession.completed_at.desc())
        .limit(50)
        .all()
    )
    return {
        "status": "success",
        "data": {
            "sessions": [
                {
                    "id": s.id,
                    "session_name": s.session_name,
                    "category_filter": s.category_filter,
                    "difficulty_filter": s.difficulty_filter,
                    "total_questions": s.total_questions,
                    "correct_answers": s.correct_answers,
                    "score_pct": s.score_pct,
                    "started_at": str(s.started_at) if s.started_at else None,
                    "completed_at": str(s.completed_at) if s.completed_at else None,
                }
                for s in sessions
            ]
        },
    }


@router.get("/categories")
async def get_categories(db: Session = Depends(get_db)):
    """Get all question categories and counts."""
    questions = db.query(FRMQuestion).all()
    categories: dict = {}
    for q in questions:
        cat = q.category
        if cat not in categories:
            categories[cat] = {"total": 0, "easy": 0, "medium": 0, "hard": 0}
        categories[cat]["total"] += 1
        categories[cat][q.difficulty] += 1

    return {
        "status": "success",
        "data": {"categories": categories, "total_questions": len(questions)},
    }
