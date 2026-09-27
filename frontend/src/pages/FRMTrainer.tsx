import { useState, useEffect, useCallback } from 'react'
import { frmApi } from '@/services/api'
import {
  Panel, SectionHeader, LoadingSpinner, ErrorMessage,
  FormField, Select, Button, DataTable, StatusBadge,
} from '@/components/ui'
import { useI18n } from '@/i18n'

type Screen = 'start' | 'quiz' | 'complete'

interface Question {
  id: number
  category: string
  difficulty: string
  prompt: string
  option_a: string; option_b: string; option_c: string; option_d: string
  is_calculation?: boolean
  formula?: string
}
interface SessionAnswer { question_id: number; correct: boolean; your_answer: string; correct_answer: string; explanation: string; formula?: string; derivation?: string; common_mistake?: string; question_prompt: string }

export default function FRMTrainer() {
  const { t } = useI18n()
  const fm = t.frm
  const [screen, setScreen] = useState<Screen>('start')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quiz config
  const [nQuestions, setNQuestions] = useState(5)
  const [category, setCategory] = useState<string>('all')
  const [difficulty, setDifficulty] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])

  // Active quiz
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, unknown> | null>(null)
  const [answers, setAnswers] = useState<SessionAnswer[]>([])

  // History
  const [history, setHistory] = useState<Record<string, unknown>[]>([])
  const [bankOverview, setBankOverview] = useState<Record<string, unknown> | null>(null)

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    try {
      const [catRes, histRes] = await Promise.all([
        frmApi.categories(),
        frmApi.history(),
      ])
      setCategories(Object.keys(catRes.data.data.categories || {}))
      setHistory(histRes.data.data.sessions || [])
      setBankOverview(catRes.data.data)
    } catch {}
  }

  async function startQuiz() {
    setLoading(true); setError(null)
    try {
      const params: Record<string, unknown> = { n_questions: nQuestions }
      if (category !== 'all') params.category = category
      if (difficulty !== 'all') params.difficulty = difficulty
      const res = await frmApi.startQuiz(params)
      const data = res.data.data
      setSessionId(data.session_id)
      setQuestions(data.questions)
      setCurrentIdx(0)
      setSelectedAnswer(null)
      setFeedback(null)
      setAnswers([])
      setScreen('quiz')
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to start quiz') }
    finally { setLoading(false) }
  }

  async function submitAnswer(ans: string) {
    if (!sessionId || feedback) return
    setSelectedAnswer(ans)
    try {
      const q = questions[currentIdx]
      const res = await frmApi.submitAnswer({ session_id: sessionId, question_id: q.id, selected_answer: ans })
      const d = res.data.data
      setFeedback(d)
      setAnswers(prev => [...prev, {
        question_id: q.id, correct: d.is_correct, your_answer: ans,
        correct_answer: d.correct_answer, explanation: d.explanation,
        formula: d.formula, derivation: d.derivation, common_mistake: d.common_mistake,
        question_prompt: q.prompt,
      }])
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to submit') }
  }

  async function nextQuestion() {
    if (currentIdx + 1 >= questions.length) {
      // Complete
      try {
        await frmApi.completeQuiz({ session_id: sessionId! })
      } catch {}
      setScreen('complete')
    } else {
      setCurrentIdx(i => i + 1)
      setSelectedAnswer(null)
      setFeedback(null)
    }
  }

  const q = questions[currentIdx]
  const correctCount = answers.filter(a => a.correct).length
  const progress = questions.length > 0 ? ((currentIdx + (feedback ? 1 : 0)) / questions.length) * 100 : 0

  const diffColor = (d: string) => ({ easy: 'text-emerald-400', medium: 'text-amber-400', hard: 'text-red-400' })[d] ?? 'text-slate-400'

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title={fm.title} subtitle={fm.subtitle} />
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ── Start Screen ─────────────────────────────────────────────────── */}
      {screen === 'start' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={fm.startTitle} className="lg:col-span-1">
            <div className="space-y-3">
              <FormField label={fm.numQuestions}>
                <Select value={nQuestions} onChange={e => setNQuestions(parseInt(e.target.value))}>
                  {[3, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
                </Select>
              </FormField>
              <FormField label={fm.categoryFilter}>
                <Select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="all">{fm.allCategories}</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
              <FormField label={fm.difficulty}>
                <Select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  <option value="all">{fm.allDiff}</option>
                  <option value="easy">{fm.easy}</option>
                  <option value="medium">{fm.medium}</option>
                  <option value="hard">{fm.hard}</option>
                </Select>
              </FormField>
              <Button onClick={startQuiz} disabled={loading} className="w-full" size="lg">
                {loading ? fm.startLoading : fm.startBtn}
              </Button>
            </div>
          </Panel>

          <div className="lg:col-span-2 space-y-4">
            {bankOverview && (
              <Panel title={fm.bankTitle}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(bankOverview.categories ?? {}).map(([cat, info]: [string, unknown]) => (
                    <div key={cat} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-[#0f1117] rounded-lg p-2.5 border border-[#1e2635]">
                      <span className="text-xs text-slate-300 leading-tight">{cat}</span>
                      <span className="text-xs text-emerald-400 font-mono font-bold">{Object.values(info as Record<string, number>).reduce((a, b) => a + b, 0)} Qs</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {history.length > 0 && (
              <Panel title={fm.historyTitle}>
                <DataTable
                  headers={fm.histHeaders.slice(0, 5)}
                  rows={history.map((h: unknown, i: number) => [
                    i + 1,
                    (h as any).category ?? fm.colAll,
                    (h as any).difficulty ?? fm.colAll,
                    `${(h as any).correct_count}/${(h as any).total_questions}`,
                    (h as any).score_pct ? `${(h as any).score_pct.toFixed(0)}%` : '—',
                  ])}
                />
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* ── Quiz Screen ──────────────────────────────────────────────────── */}
      {screen === 'quiz' && q && (
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#1e2635] rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {currentIdx + 1}/{questions.length} — {correctCount} {fm.progLabel}
            </span>
          </div>

          {/* Question */}
          <Panel>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <StatusBadge status={q.difficulty === 'easy' ? 'PASS' : q.difficulty === 'hard' ? 'FAIL' : 'WARN'} label={q.difficulty.toUpperCase()} />
              <span className="text-xs text-slate-500">{q.category}</span>
              {q.is_calculation && <span className="text-xs text-blue-400">{fm.calculation}</span>}
            </div>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed mb-4">{q.prompt}</p>
            {q.formula && (
              <div className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-4 font-mono">
                📐 {fm.formulaHint}: {q.formula}
              </div>
            )}
            {/* Options */}
            <div className="space-y-2">
              {(['a', 'b', 'c', 'd'] as const).map(opt => {
                const val = `option_${opt}` as keyof Question
                const answerLetter = opt.toUpperCase()
                const isSelected = selectedAnswer === answerLetter
                const isCorrect = feedback && (feedback as any).correct_answer === answerLetter
                const isWrong = feedback && isSelected && !(feedback as any).is_correct
                return (
                  <button
                    key={opt}
                    onClick={() => submitAnswer(answerLetter)}
                    disabled={!!feedback}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-150 min-h-[44px]
                      ${isCorrect ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
                        isWrong ? 'bg-red-500/20 border-red-500/50 text-red-300' :
                        isSelected ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' :
                        'bg-[#0f1117] border-[#1e2635] text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/5'}
                      ${feedback ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="font-bold mr-2">{answerLetter}.</span>{q[val] as string}
                  </button>
                )
              })}
            </div>
          </Panel>

          {/* Feedback */}
          {feedback && (
            <Panel>
              <div className={`text-sm font-bold mb-2 ${(feedback as any).is_correct ? 'text-emerald-400' : 'text-red-400'}`}>
                {(feedback as any).is_correct ? fm.feedbackCorrect : `${fm.feedbackIncorrect} ${(feedback as any).correct_answer}`}
              </div>
              <p className="text-xs text-slate-300 mb-3 leading-relaxed">{(feedback as any).explanation}</p>
              {(feedback as any).formula && (
                <div className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded px-3 py-2 mb-2 font-mono">
                  {fm.feedbackFormula}: {(feedback as any).formula}
                </div>
              )}
              {(feedback as any).common_mistake && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
                  {fm.feedbackMistake}: {(feedback as any).common_mistake}
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <Button onClick={nextQuestion} size="lg">
                  {currentIdx + 1 >= questions.length ? fm.completeQuiz : fm.nextQuestion}
                </Button>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ── Complete Screen ──────────────────────────────────────────────── */}
      {screen === 'complete' && (
        <div className="max-w-xl mx-auto space-y-4">
          <Panel>
            <div className="text-center mb-6">
              <div className="text-5xl mb-2">{correctCount / questions.length >= 0.8 ? '🏆' : correctCount / questions.length >= 0.6 ? '✅' : '📚'}</div>
              <div className="text-2xl font-bold text-slate-100">{correctCount}/{questions.length} {fm.scoreLabel}</div>
              <div className={`text-lg mt-1 ${correctCount / questions.length >= 0.8 ? 'text-emerald-400' : correctCount / questions.length >= 0.6 ? 'text-amber-400' : 'text-red-400'}`}>
                {correctCount / questions.length >= 0.8 ? fm.gradeExcellent : correctCount / questions.length >= 0.6 ? fm.gradePass : fm.gradeFail}
                {' '}— {(correctCount / questions.length * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-[#1e2635] rounded-full h-3 mb-6">
              <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${(correctCount / questions.length) * 100}%` }} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="secondary" onClick={() => { setScreen('start'); loadInitial() }}>{fm.backToMenu}</Button>
              <Button onClick={() => { setScreen('start'); setTimeout(startQuiz, 50) }}>{fm.newQuiz}</Button>
            </div>
          </Panel>

          <Panel title={fm.questionBreakdown}>
            <div className="space-y-3">
              {answers.map((a, i) => (
                <div key={i} className={`border rounded-xl p-3 ${a.correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-lg flex-shrink-0 ${a.correct ? 'text-emerald-400' : 'text-red-400'}`}>{a.correct ? '✓' : '✗'}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-300 leading-snug">{a.question_prompt.slice(0, 120)}{a.question_prompt.length > 120 ? '...' : ''}</p>
                      {!a.correct && (
                        <div className="text-xs text-slate-400 mt-1">
                          {fm.youAnswered} <span className="text-red-400">{a.your_answer}</span> →
                          {fm.correct} <span className="text-emerald-400">{a.correct_answer}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
