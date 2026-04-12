'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Category, CategoryProgress, Question } from './components/types';
import { CATEGORIES, ACHIEVEMENTS, MAX_POINTS_PER_CATEGORY } from './components/types';
import { QuizSession } from './components/quiz-session';
import { AchievementTimeline } from './components/achievement-timeline';

function loadProgress(): Record<Category, CategoryProgress> {
  if (typeof window === 'undefined') return getDefaultProgress();
  try {
    const raw = localStorage.getItem('inksuite-quiz-progress');
    return raw ? JSON.parse(raw) : getDefaultProgress();
  } catch {
    return getDefaultProgress();
  }
}

function getDefaultProgress(): Record<Category, CategoryProgress> {
  return {
    geometry: { totalPoints: 0, questionsAnswered: [], achievementLevel: -1, quizzesTaken: 0 },
    math: { totalPoints: 0, questionsAnswered: [], achievementLevel: -1, quizzesTaken: 0 },
    physics: { totalPoints: 0, questionsAnswered: [], achievementLevel: -1, quizzesTaken: 0 },
    biology: { totalPoints: 0, questionsAnswered: [], achievementLevel: -1, quizzesTaken: 0 },
    chemistry: { totalPoints: 0, questionsAnswered: [], achievementLevel: -1, quizzesTaken: 0 },
  };
}

function saveProgress(progress: Record<Category, CategoryProgress>) {
  localStorage.setItem('inksuite-quiz-progress', JSON.stringify(progress));
}

function getAchievementLevel(points: number, quizzesTaken: number): number {
  if (quizzesTaken === 0) return -1;
  const pct = points / MAX_POINTS_PER_CATEGORY;
  for (let i = ACHIEVEMENTS.length - 1; i >= 0; i--) {
    if (pct >= ACHIEVEMENTS[i].threshold) return i;
  }
  return 0;
}

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<Category, CategoryProgress>>(getDefaultProgress());
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);

  useEffect(() => {
    setProgress(loadProgress());
    import('./data/questions')
      .then((mod) => setQuestions(mod.questions))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, []);

  const startQuiz = useCallback(
    (category: Category) => {
      const catQuestions = questions.filter((q) => q.category === category);
      // Pick 5 random questions not yet answered (or random if all answered)
      const unanswered = catQuestions.filter(
        (q) => !progress[category].questionsAnswered.includes(q.id),
      );
      const pool = unanswered.length >= 5 ? unanswered : catQuestions;
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
      setSessionQuestions(shuffled);
      setActiveCategory(category);
    },
    [questions, progress],
  );

  const handleComplete = useCallback(
    (results: { questionId: string; correct: boolean; points: number }[]) => {
      if (!activeCategory) return;
      const newProgress = { ...progress };
      const cat = { ...newProgress[activeCategory] };
      let pointsEarned = 0;
      for (const r of results) {
        pointsEarned += r.points;
        if (!cat.questionsAnswered.includes(r.questionId)) {
          cat.questionsAnswered = [...cat.questionsAnswered, r.questionId];
        }
      }
      cat.totalPoints += pointsEarned;
      cat.quizzesTaken += 1;
      cat.achievementLevel = getAchievementLevel(cat.totalPoints, cat.quizzesTaken);
      newProgress[activeCategory] = cat;
      setProgress(newProgress);
      saveProgress(newProgress);
    },
    [activeCategory, progress],
  );

  const handleBack = useCallback(() => {
    setActiveCategory(null);
    setSessionQuestions([]);
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="py-24 text-center text-ink-600">Loading questions…</div>
      </main>
    );
  }

  // Quiz in progress
  if (activeCategory && sessionQuestions.length > 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <QuizSession
          questions={sessionQuestions}
          onComplete={handleComplete}
          onBack={handleBack}
        />
      </main>
    );
  }

  // Category selection
  const totalPoints = Object.values(progress).reduce((s, p) => s + p.totalPoints, 0);
  const totalQuizzes = Object.values(progress).reduce((s, p) => s + p.quizzesTaken, 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
      <header className="mb-10">
        <a
          href="https://inksuite.xyz"
          className="mb-6 inline-flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 shadow-sm transition hover:bg-purple-200 hover:text-ink-900"
        >
          ← inksuite.xyz
        </a>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
          Test Yourself
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-700">
          5 categories, 5 questions per round, 3 difficulty levels. Earn points, unlock
          achievements. {questions.length} questions available.
        </p>
      </header>

      {/* Overall stats */}
      {totalQuizzes > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total Points</div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink-500">{totalPoints}</div>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Quizzes Taken</div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink-900">{totalQuizzes}</div>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Questions Seen</div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink-900">
              {Object.values(progress).reduce((s, p) => s + p.questionsAnswered.length, 0)}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-purple-100 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Achievements</div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink-900">
              {Object.values(progress).filter((p) => p.achievementLevel >= 0).length}/5
            </div>
          </div>
        </div>
      )}

      {/* Category cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const p = progress[cat.id];
          const catQuestionCount = questions.filter((q) => q.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => startQuiz(cat.id)}
              disabled={catQuestionCount === 0}
              className="group rounded-xl bg-white p-6 text-left ring-1 ring-inset ring-purple-100 shadow-sm transition hover:bg-purple-50 hover:ring-ink-500"
            >
              <div className="mb-3 flex items-start justify-between">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg ${cat.bgColor} ${cat.color} ring-1 ring-inset ${cat.ringColor}`}>
                  {cat.icon}
                </span>
                {p.achievementLevel >= 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-300">
                    {ACHIEVEMENTS[p.achievementLevel]?.name}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-ink-900">{cat.label}</h3>
              <p className="mt-1 text-xs text-ink-600">{catQuestionCount} questions</p>
              {p.quizzesTaken > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[10px] text-ink-500">
                    <span>{p.totalPoints} pts</span>
                    <span>{p.quizzesTaken} quizzes</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-purple-100">
                    <div
                      className="h-1.5 rounded-full bg-ink-500 transition-all"
                      style={{ width: `${Math.min(100, (p.totalPoints / MAX_POINTS_PER_CATEGORY) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Achievement timelines per category */}
      {totalQuizzes > 0 && (
        <div className="mt-10 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-600">
            Achievement Progress
          </h2>
          {CATEGORIES.filter((c) => progress[c.id].quizzesTaken > 0).map((cat) => (
            <div key={cat.id}>
              <div className="mb-1 text-xs font-semibold text-ink-700">{cat.label}</div>
              <AchievementTimeline
                totalPoints={progress[cat.id].totalPoints}
                achievementLevel={progress[cat.id].achievementLevel}
              />
            </div>
          ))}
        </div>
      )}

      <footer className="mt-16 border-t border-purple-200 pt-8 text-sm text-ink-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>Part of Ink Suite · MIT license</span>
          <a href="https://github.com/erdemcrypto3/inksuite" className="hover:text-ink-500" target="_blank" rel="noopener noreferrer">source →</a>
        </div>
      </footer>
    </main>
  );
}
