'use client';

import { useState } from 'react';
import type { Question, Difficulty } from './types';
import { DIFFICULTY_COLORS } from './types';
import { GeometrySvg } from './geometry-svg';

type Props = {
  questions: Question[];
  onComplete: (results: { questionId: string; correct: boolean; points: number }[]) => void;
  onBack: () => void;
};

export function QuizSession({ questions, onComplete, onBack }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [results, setResults] = useState<{ questionId: string; correct: boolean; points: number }[]>([]);
  const [finished, setFinished] = useState(false);

  const q = questions[currentIdx];
  const isCorrect = selected !== null && selected === q.correctIndex;
  const isAnswered = selected !== null;

  function handleSelect(idx: number) {
    if (isAnswered) return;
    setSelected(idx);
    const correct = idx === q.correctIndex;
    setResults((prev) => [
      ...prev,
      { questionId: q.id, correct, points: correct ? q.points : 0 },
    ]);
  }

  function handleNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
      setShowSolution(false);
    } else {
      setFinished(true);
      onComplete([...results]);
    }
  }

  if (finished) {
    const totalPoints = results.reduce((s, r) => s + r.points, 0);
    const correctCount = results.filter((r) => r.correct).length;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-inset ring-purple-100 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink-900">Quiz Complete!</h2>
          <div className="mt-4 font-mono text-5xl font-bold text-ink-500">{totalPoints}</div>
          <div className="mt-2 text-ink-600">points earned</div>
          <div className="mt-4 text-sm text-ink-700">
            {correctCount}/{questions.length} correct
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={onBack}
              className="rounded-lg bg-purple-100 px-5 py-2.5 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-purple-200 hover:bg-purple-200"
            >
              Back to Categories
            </button>
          </div>
        </div>

        {/* Results breakdown */}
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={r.questionId}
              className={`rounded-lg px-4 py-2 text-sm ring-1 ring-inset ${
                r.correct
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-red-50 text-red-700 ring-red-200'
              }`}
            >
              Q{i + 1}: {r.correct ? '✓ Correct' : '✗ Wrong'} · {r.points} pts
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-sm text-ink-600">
        <button
          onClick={onBack}
          className="text-ink-500 hover:text-ink-700"
        >
          ← Quit
        </button>
        <span>
          Question {currentIdx + 1}/{questions.length}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${DIFFICULTY_COLORS[q.difficulty]}`}>
          {q.difficulty} · {q.points}pts
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-purple-100">
        <div
          className="h-1.5 rounded-full bg-ink-500 transition-all"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="rounded-xl bg-white p-6 ring-1 ring-inset ring-purple-100 shadow-sm">
        <p className="text-lg font-semibold text-ink-900 leading-relaxed">{q.question}</p>

        {q.svg && (
          <div className="mt-4 flex justify-center">
            <GeometrySvg name={q.svg} />
          </div>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2">
        {q.options.map((option, idx) => {
          let style = 'bg-white ring-purple-200 hover:bg-purple-50 cursor-pointer text-ink-900';
          if (isAnswered) {
            if (idx === q.correctIndex) {
              style = 'bg-emerald-50 ring-emerald-400 text-emerald-800 font-semibold';
            } else if (idx === selected && !isCorrect) {
              style = 'bg-red-50 ring-red-400 text-red-800';
            } else {
              style = 'bg-white/50 ring-purple-100 text-ink-400 cursor-not-allowed';
            }
          }
          const letter = String.fromCharCode(65 + idx); // A, B, C, D, E
          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={isAnswered}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm ring-1 ring-inset transition ${style}`}
            >
              <span className="mr-3 inline-block w-6 rounded bg-purple-100/50 text-center font-mono font-bold text-ink-500">
                {letter}
              </span>
              {option}
            </button>
          );
        })}
      </div>

      {/* After answer */}
      {isAnswered && (
        <div className="space-y-3">
          {isCorrect ? (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300">
              ✓ Correct! +{q.points} points
            </div>
          ) : (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-300">
              <span className="font-semibold">✗ Incorrect.</span> The answer is {String.fromCharCode(65 + q.correctIndex)}.
            </div>
          )}

          {!isCorrect && !showSolution && (
            <button
              onClick={() => setShowSolution(true)}
              className="text-sm text-ink-500 hover:text-ink-700 underline"
            >
              Show solution
            </button>
          )}

          {showSolution && (
            <div className="rounded-lg bg-purple-50 px-4 py-3 text-sm text-ink-700 ring-1 ring-inset ring-purple-200">
              <span className="font-semibold">Solution:</span> {q.solution}
            </div>
          )}

          <button
            onClick={handleNext}
            className="w-full rounded-lg bg-ink-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink-700"
          >
            {currentIdx < questions.length - 1 ? 'Next Question →' : 'See Results'}
          </button>
        </div>
      )}
    </div>
  );
}
