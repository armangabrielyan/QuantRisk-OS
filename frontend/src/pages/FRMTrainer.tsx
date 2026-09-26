import { useState, useEffect, useRef } from 'react'
import { frmApi } from '@/services/api'
import {
  MetricCard, Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  Select, Button, StatusBadge
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, Clock, BookOpen, Trophy, ChevronRight, RotateCcw } from 'lucide-react'

interface Question {
  id: number
  category: string
  subcategory?: string
  difficulty: string
  prompt: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  formula?: string
  is_calculation: boolean
  tags?: string[]
}

interface AnswerFeedback {
  is_correct: boolean
  selected_answer: string
  correct_answer: string
  explanation: string
  formula?: string
  derivation?: string
  common_mistake?: string
}

type Mode = 'menu' | 'quiz' | 'review' | 'history'

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  hard: 'text-red-400 border-red-500/30 bg-red-500/10',
}

export default function FRMTrainer() {
  const [mode, setMode] = useState<Mode>('menu')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Categories / metadata
  const [categories, setCategories] = useState<Record<string, Record<string, number>>>({})
  const [history, setHistory] = useState<unknown[]>([])

  // Quiz config
  const [quizConfig, setQuizConfig] = useState({
    n_questions: 10,
    category: '',
    difficulty: '',
  })

  // Active quiz state
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [answers, setAnswers] = useState<Record<number, AnswerFeedback>>({})
  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Final score
  const [finalScore, setFinalScore] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    loadCategories()
    loadHistory()
  }, [])

  useEffect(() => {
    if (mode === 'quiz') {
      setTimer(0)
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [mode, currentIdx])

  async function loadCategories() {
    try {
      const res = await frmApi.categories()
      setCategories(res.data.data.categories)
    } catch { /* ignore */ }
  }

  async function loadHistory() {
    try {
      const res = await frmApi.history()
      setHistory(res.data.data.sessions)
    } catch { /* ignore */ }
  }

  async function startQuiz() {
    setLoading(true); setError(null)
    try {
      const res = await frmApi.startQuiz({
        n_questions: quizConfig.n_questions,
        category: quizConfig.category || undefined,
        difficulty: quizConfig.difficulty || undefined,
      })
      const d = res.data.data
      setSessionId(d.session_id)
      setQuestions(d.questions)
      setCurrentIdx(0)
      setSelectedAnswer(null)
      setFeedback(null)
      setAnswers({})
      setFinalScore(null)
      setMode('quiz')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start quiz')
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer(answer: string) {
    if (!sessionId || feedback) return
    setSelectedAnswer(answer)
    try {
      const res = await frmApi.submitAnswer({
        session_id: sessionId,
        question_id: questions[currentIdx].id,
        selected_answer: answer,
        time_taken_seconds: timer,
      })
      const fb = res.data.data as AnswerFeedback
      setFeedback(fb)
      setAnswers(prev => ({ ...prev, [questions[currentIdx].id]: fb }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit answer')
    }
  }

  async function nextQuestion() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1)
      setSelectedAnswer(null)
      setFeedback(null)
    } else {
      // Complete quiz
      try {
        const res = await frmApi.completeQuiz({ session_id: sessionId! })
        setFinalScore(res.data.data)
        loadHistory()
        setMode('review')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to complete quiz')
      }
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const q = questions[currentIdx]
  const answered = q ? !!answers[q.id] : false
  const correctCount = Object.values(answers).filter(a => a.is_correct).length

  return (
    <div className="space-y-6">
      <SectionHeader title="FRM Trainer" subtitle="GARP FRM Part I & II — Calculation-Heavy Question Bank" />

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* MENU MODE */}
      {mode === 'menu' && (
        <div className="grid grid-cols-3 gap-4">
          {/* Quiz Setup */}
          <Panel title="Start a Quiz Session" className="col-span-2">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Number of Questions</label>
                  <Select value={quizConfig.n_questions}
                    onChange={e => setQuizConfig(p => ({ ...p, n_questions: parseInt(e.target.value) }))}>
                    {[5, 10, 15, 20, 35].map(n => <option key={n} value={n}>{n} Questions</option>)}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Category Filter</label>
                  <Select value={quizConfig.category}
                    onChange={e => setQuizConfig(p => ({ ...p, category: e.target.value }))}>
                    <option value="">All Categories</option>
                    {Object.keys(categories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Difficulty</label>
                  <Select value={quizConfig.difficulty}
                    onChange={e => setQuizConfig(p => ({ ...p, difficulty: e.target.value }))}>
                    <option value="">All Difficulties</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>
                </div>
              </div>
              <Button onClick={startQuiz} disabled={loading} size="lg" className="w-full">
                {loading ? 'Loading Questions...' : '🎯 Start Quiz Session'}
              </Button>
            </div>
          </Panel>

          {/* Category overview */}
          <Panel title="Question Bank Overview">
            <div className="space-y-2">
              {Object.entries(categories).map(([cat, counts]) => (
                <div key={cat} className="flex items-center justify-between py-1.5 border-b border-[#1e2635]/50 last:border-0">
                  <div>
                    <div className="text-xs text-slate-300 font-medium">{cat}</div>
                    <div className="flex gap-2 mt-0.5">
                      {['easy', 'medium', 'hard'].map(d => (counts[d] ?? 0) > 0 ? (
                        <span key={d} className={cn('text-xs px-1.5 py-0.5 rounded border', DIFFICULTY_COLORS[d])}>
                          {d[0].toUpperCase()}: {counts[d]}
                        </span>
                      ) : null)}
                    </div>
                  </div>
                  <span className="text-sm font-mono text-emerald-400">{counts.total}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* History */}
          {history.length > 0 && (
            <Panel title="Recent Quiz History" className="col-span-3">
              <DataTable
                headers={['Session', 'Category', 'Difficulty', 'Score', 'Grade', 'Date']}
                rows={(history as Record<string, unknown>[]).slice(0, 8).map(s => [
                  s.session_name as string,
                  (s.category_filter as string) || 'All',
                  (s.difficulty_filter as string) || 'All',
                  `${s.correct_answers}/${s.total_questions} (${s.score_pct}%)`,
                  <StatusBadge
                    status={(s.score_pct as number) >= 65 ? 'PASS' : 'FAIL'}
                    label={(s.score_pct as number) >= 80 ? 'Excellent' : (s.score_pct as number) >= 65 ? 'Pass' : 'Fail'}
                  />,
                  s.completed_at ? (s.completed_at as string).slice(0, 10) : '—',
                ])}
              />
            </Panel>
          )}
        </div>
      )}

      {/* QUIZ MODE */}
      {mode === 'quiz' && q && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-[#1e2635] rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-slate-400">{currentIdx + 1} / {questions.length}</span>
            <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatTime(timer)}
            </span>
            <span className="text-xs text-emerald-400 font-mono">{correctCount} correct</span>
          </div>

          {/* Question card */}
          <Panel>
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <span className={cn('text-xs px-2 py-0.5 rounded border', DIFFICULTY_COLORS[q.difficulty])}>
                  {q.difficulty.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500">{q.category}</span>
                {q.subcategory && <span className="text-xs text-slate-600">· {q.subcategory}</span>}
                {q.is_calculation && <span className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded">📐 Calculation</span>}
              </div>

              {/* Question text */}
              <div className="text-sm text-slate-200 leading-relaxed font-medium">
                {q.prompt}
              </div>

              {/* Formula hint */}
              {q.formula && (
                <div className="bg-[#0f1117] border border-[#1e2635] rounded p-3 font-mono text-xs text-emerald-300">
                  {q.formula}
                </div>
              )}

              {/* Options */}
              <div className="space-y-2 mt-2">
                {(['A', 'B', 'C', 'D'] as const).map(letter => {
                  const optKey = `option_${letter.toLowerCase()}` as keyof Question
                  const optText = q[optKey] as string | undefined
                  if (!optText) return null

                  let bgClass = 'border-[#1e2635] hover:border-emerald-500/50 hover:bg-emerald-500/5'
                  if (feedback) {
                    if (letter === feedback.correct_answer) bgClass = 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    else if (letter === selectedAnswer && !feedback.is_correct) bgClass = 'border-red-500 bg-red-500/15 text-red-300'
                    else bgClass = 'border-[#1e2635] opacity-50'
                  } else if (selectedAnswer === letter) {
                    bgClass = 'border-emerald-500/60 bg-emerald-500/10'
                  }

                  return (
                    <button key={letter}
                      onClick={() => !feedback && submitAnswer(letter)}
                      disabled={!!feedback}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border text-sm transition-all flex items-start gap-3',
                        bgClass
                      )}>
                      <span className="font-mono font-bold text-xs mt-0.5 flex-shrink-0">{letter}.</span>
                      <span>{optText}</span>
                      {feedback && letter === feedback.correct_answer && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto flex-shrink-0" />}
                      {feedback && letter === selectedAnswer && !feedback.is_correct && <XCircle className="w-4 h-4 text-red-400 ml-auto flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </Panel>

          {/* Feedback panel */}
          {feedback && (
            <Panel className={feedback.is_correct ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {feedback.is_correct
                    ? <><CheckCircle className="w-5 h-5 text-emerald-400" /><span className="text-sm font-semibold text-emerald-400">Correct!</span></>
                    : <><XCircle className="w-5 h-5 text-red-400" /><span className="text-sm font-semibold text-red-400">Incorrect — Answer: {feedback.correct_answer}</span></>
                  }
                </div>
                <div className="text-sm text-slate-300 leading-relaxed">{feedback.explanation}</div>
                {feedback.formula && (
                  <div className="bg-[#0f1117] rounded p-3 border border-[#1e2635]">
                    <div className="text-xs text-slate-500 mb-1">Formula</div>
                    <div className="font-mono text-xs text-emerald-300">{feedback.formula}</div>
                  </div>
                )}
                {feedback.derivation && (
                  <div className="bg-[#0f1117] rounded p-3 border border-[#1e2635]">
                    <div className="text-xs text-slate-500 mb-1">Derivation / Steps</div>
                    <div className="text-xs text-slate-400 whitespace-pre-wrap">{feedback.derivation}</div>
                  </div>
                )}
                {feedback.common_mistake && (
                  <div className="bg-amber-500/10 rounded p-3 border border-amber-500/30">
                    <div className="text-xs text-amber-400 mb-1">⚠️ Common Mistake</div>
                    <div className="text-xs text-amber-300">{feedback.common_mistake}</div>
                  </div>
                )}
                <Button onClick={nextQuestion} className="w-full mt-2">
                  {currentIdx < questions.length - 1
                    ? <><ChevronRight className="w-4 h-4 inline mr-1" />Next Question</>
                    : <><Trophy className="w-4 h-4 inline mr-1" />Complete Quiz</>
                  }
                </Button>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* REVIEW MODE (score screen) */}
      {mode === 'review' && finalScore && (
        <div className="space-y-4">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">
              {(finalScore.score_pct as number) >= 80 ? '🏆' : (finalScore.score_pct as number) >= 65 ? '✅' : '📚'}
            </div>
            <div className="text-3xl font-bold text-slate-100 mb-1">{finalScore.score_pct as number}%</div>
            <div className="text-slate-400">{finalScore.correct_answers as number} / {finalScore.total_questions as number} correct</div>
            <div className={cn('text-lg font-semibold mt-2',
              (finalScore.score_pct as number) >= 80 ? 'text-emerald-400' :
              (finalScore.score_pct as number) >= 65 ? 'text-blue-400' : 'text-red-400'
            )}>
              {finalScore.grade as string}
            </div>
          </div>

          {/* Per-question breakdown */}
          <Panel title="Question Breakdown">
            <div className="space-y-2">
              {questions.map((q, i) => {
                const fb = answers[q.id]
                return (
                  <div key={q.id} className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border text-sm',
                    fb?.is_correct ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
                  )}>
                    {fb?.is_correct ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-400 mb-0.5">Q{i + 1} · {q.category}</div>
                      <div className="text-xs text-slate-300 line-clamp-2">{q.prompt}</div>
                      {fb && !fb.is_correct && <div className="text-xs text-red-400 mt-1">Correct: {fb.correct_answer} · You answered: {fb.selected_answer}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <div className="flex gap-3">
            <Button onClick={() => setMode('menu')} variant="secondary" className="flex-1">
              <RotateCcw className="w-4 h-4 inline mr-1" />Back to Menu
            </Button>
            <Button onClick={startQuiz} className="flex-1">
              Start New Quiz
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Local DataTable component (avoids import issue)
function DataTable({ headers, rows }: { headers: string[]; rows: unknown[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left text-xs text-slate-500 uppercase tracking-wider pb-2 border-b border-[#1e2635] pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1e2635]/50 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-slate-300 font-mono text-xs">{cell as React.ReactNode}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
