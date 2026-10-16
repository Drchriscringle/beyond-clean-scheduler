import { useState } from "react";
import * as icons from "lucide-react";
import { Check, X, HelpCircle, Lightbulb, PenLine, Star, Coins } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useAwardLearning } from "../../hooks/useRewards";
import { dailyCard, dayKey } from "../../lib/lessons";
import { quizFor } from "../../lib/quizzes";
import { dateKey } from "../../lib/schedule";
import { playCoinShower, playTap } from "../../lib/sound";
import { Card } from "../ui";
import { Scratchpad } from "../Scratchpad";

const PREFIX = "pm_lesson_";

function readState(key) {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key) || "null");
  } catch {
    return null;
  }
}
function writeState(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// "Money word of the day" — changes daily, pitched at the child's age band.
// First pass through the deck teaches; the next pass quizzes (recap first,
// then the question, with a hint and a working-out pad). A right answer
// earns whatever the parent has set: pocket money, points, or nothing.
export function LessonCard({ kid, mode, color }) {
  const money = useMoney();
  const { lesson, kind } = dailyCard(mode, kid.id);
  const quiz = kind === "quiz" ? quizFor(mode, lesson.term) : null;
  const key = `${kid.id}_${dayKey()}`;
  const [state, setState] = useState(() => readState(key) || { done: false, picked: null, recapDone: false, hint: false, award: null });
  const [padOpen, setPadOpen] = useState(false);
  const award = useAwardLearning();
  const little = mode === "little";

  const Icon = icons[lesson.icon] || icons.BookOpen;
  const body = typeof lesson.body === "function" ? lesson.body(money) : lesson.body;
  const tryIt = typeof lesson.tryIt === "function" ? lesson.tryIt(money) : lesson.tryIt;

  const save = (next) => {
    writeState(key, next);
    setState(next);
  };

  const earnedLabel = (a) => {
    if (!a || a.already) return null;
    if (a.mode === "money" && a.amount_pence > 0) return `+${money(a.amount_pence)} into your jars!`;
    if (a.mode === "points" && a.points > 0) return `+${a.points} ${a.points === 1 ? "point" : "points"}!`;
    return null;
  };

  if (state.done) {
    const correct = quiz && state.picked === quiz.answer;
    return (
      <button onClick={() => save({ ...state, done: false })} className="w-full flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur border border-line px-4 py-3 text-left">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: color.soft, color: color.main }}>
          {quiz ? (correct ? <Check size={18} /> : <HelpCircle size={18} />) : <Icon size={18} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted">{quiz ? "Today's quiz" : "Today's money word"}</span>
          <span className="block text-[14px] font-semibold text-ink truncate">{lesson.term}{quiz ? (correct ? " · got it right" : " · worth another look") : ""}</span>
        </span>
        <span className="text-[12px] font-semibold" style={{ color: color.main }}>Open</span>
      </button>
    );
  }

  if (quiz) {
    const picked = state.picked;
    const answered = picked !== null && picked !== undefined;
    const correct = answered && picked === quiz.answer;
    const choose = (i) => {
      if (answered) return;
      const right = i === quiz.answer;
      if (right) playCoinShower(6, 0.6);
      else playTap();
      save({ ...state, done: false, picked: i, recapDone: true });
      if (right) {
        award.mutate(
          { childId: kid.id, kind: "quiz", dayKey: dateKey(), correct: 1 },
          { onSuccess: (a) => save({ ...state, done: false, picked: i, recapDone: true, award: a }) }
        );
      }
    };

    // Step 1: a quick recap of what the word means. Step 2: the question.
    if (!state.recapDone) {
      return (
        <Card className={little ? "p-5" : "p-4"} accent={color.fill}>
          <div className="flex items-start gap-3">
            <span className={`${little ? "h-14 w-14" : "h-11 w-11"} rounded-2xl flex items-center justify-center shrink-0`} style={{ background: color.soft, color: color.main }}>
              <Icon size={little ? 28 : 22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted">Quick recap</div>
              <div className={`${little ? "text-[22px]" : "text-[18px]"} font-bold text-ink tracking-tight`}>{lesson.term}</div>
            </div>
          </div>
          <p className={`${little ? "text-[16px]" : "text-[14px]"} text-ink mt-3 leading-relaxed`}>{body}</p>
          <p className={`${little ? "text-[14px]" : "text-[12.5px]"} text-ink-muted mt-2`}>{little ? "Read it, then there's one little question!" : "Have a read — then a quick question to see if it stuck."}</p>
          <button onClick={() => save({ ...state, recapDone: true })} className={`mt-3 w-full rounded-xl font-semibold text-white transition active:scale-[0.98] ${little ? "h-12 text-[15px]" : "h-10 text-[13.5px]"}`} style={{ background: color.fill }}>
            {little ? "Ready! Ask me" : "Ready for the question"}
          </button>
        </Card>
      );
    }

    const earned = earnedLabel(state.award);

    return (
      <Card className={little ? "p-5" : "p-4"} accent={color.fill}>
        <div className="flex items-start gap-3">
          <span className={`${little ? "h-14 w-14" : "h-11 w-11"} rounded-2xl flex items-center justify-center shrink-0`} style={{ background: color.soft, color: color.main }}>
            <HelpCircle size={little ? 28 : 22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted">Quiz time</div>
            <div className={`${little ? "text-[20px]" : "text-[17px]"} font-bold text-ink tracking-tight`}>Do you remember… {lesson.term}?</div>
          </div>
        </div>
        <p className={`${little ? "text-[16px]" : "text-[14.5px]"} text-ink mt-3 leading-relaxed`}>{quiz.q}</p>

        {!answered && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => save({ ...state, hint: true })} disabled={state.hint} className={`inline-flex items-center gap-1.5 rounded-full border px-3 font-semibold transition disabled:opacity-60 ${little ? "h-10 text-[14px]" : "h-8 text-[12.5px]"}`} style={{ borderColor: `${color.main}55`, color: color.main, background: color.soft }}>
              <Lightbulb size={14} /> {state.hint ? "Hint shown" : "Need a hint?"}
            </button>
            <button onClick={() => setPadOpen((o) => !o)} className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 font-semibold text-ink-muted hover:text-ink transition ${little ? "h-10 text-[14px]" : "h-8 text-[12.5px]"}`}>
              <PenLine size={14} /> {padOpen ? "Hide working out" : "Working out"}
            </button>
          </div>
        )}
        {state.hint && !answered && quiz.hint && (
          <div className="mt-2 rounded-xl px-3.5 py-2.5 tip-in flex items-start gap-2" style={{ background: color.soft }}>
            <Lightbulb size={15} className="mt-0.5 shrink-0" style={{ color: color.main }} />
            <p className={`${little ? "text-[14.5px]" : "text-[13px]"} text-ink leading-relaxed`}>{quiz.hint}</p>
          </div>
        )}
        {padOpen && !answered && (
          <div className="mt-2">
            <Scratchpad color={color.main} height={little ? 200 : 160} />
          </div>
        )}

        <div className="mt-3 space-y-2">
          {quiz.options.map((opt, i) => {
            const isAnswer = i === quiz.answer;
            const isPicked = i === picked;
            let style = { background: "#fff", borderColor: "#e9ebf2", color: "#1b1b2f" };
            if (answered && isAnswer) style = { background: "#dcf3e4", borderColor: "#15803d", color: "#0f5a2c" };
            else if (answered && isPicked) style = { background: "#fde2e2", borderColor: "#b91c1c", color: "#7a1212" };
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={answered}
                className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 text-left font-semibold transition active:scale-[0.99] ${little ? "min-h-14 text-[16px]" : "min-h-12 text-[14px]"} ${answered && isPicked && !isAnswer ? "animate-shake" : ""}`}
                style={style}
              >
                <span className="h-7 w-7 rounded-full flex items-center justify-center text-[12px] shrink-0" style={{ background: answered && (isAnswer || isPicked) ? "rgba(255,255,255,0.6)" : color.soft, color: answered && isAnswer ? "#15803d" : answered && isPicked ? "#b91c1c" : color.main }}>
                  {answered && isAnswer ? <Check size={15} /> : answered && isPicked ? <X size={15} /> : String.fromCharCode(65 + i)}
                </span>
                <span className="py-2">{opt}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="mt-3 rounded-xl px-3.5 py-3 tip-in" style={{ background: correct ? "#dcf3e4" : color.soft }}>
            <div className="text-[13px] font-semibold" style={{ color: correct ? "#0f5a2c" : color.main }}>{correct ? (little ? "Yes! Brilliant!" : "That's right!") : (little ? "Not quite — here's a reminder" : "Not quite. Remember:")}</div>
            <p className={`${little ? "text-[15px]" : "text-[13.5px]"} text-ink mt-1 leading-relaxed`}>{body}</p>
            {correct && earned && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] font-bold text-emerald-800 tip-in">
                {state.award.mode === "money" ? <Coins size={14} /> : <Star size={14} className="fill-current text-amber-500" />} {earned}
              </div>
            )}
          </div>
        )}
        {answered && (
          <button onClick={() => save({ ...state, done: true })} className={`mt-3 w-full rounded-xl font-semibold text-white transition active:scale-[0.98] ${little ? "h-12 text-[15px]" : "h-10 text-[13.5px]"}`} style={{ background: color.fill }}>
            Done
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card className={little ? "p-5" : "p-4"} accent={color.fill}>
      <div className="flex items-start gap-3">
        <span className={`${little ? "h-14 w-14" : "h-11 w-11"} rounded-2xl flex items-center justify-center shrink-0`} style={{ background: color.soft, color: color.main }}>
          <Icon size={little ? 28 : 22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted">Today's money word</div>
          <div className={`${little ? "text-[22px]" : "text-[18px]"} font-bold text-ink tracking-tight`}>{lesson.term}</div>
        </div>
      </div>
      <p className={`${little ? "text-[16px]" : "text-[14px]"} text-ink mt-3 leading-relaxed`}>{body}</p>
      <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: color.soft }}>
        <div className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: color.main }}>Try this</div>
        <p className={`${little ? "text-[15px]" : "text-[13.5px]"} text-ink mt-1 leading-relaxed`}>{tryIt}</p>
      </div>
      <button onClick={() => save({ ...state, done: true, picked: null })} className={`mt-3 w-full rounded-xl font-semibold text-white transition active:scale-[0.98] ${little ? "h-12 text-[15px]" : "h-10 text-[13.5px]"}`} style={{ background: color.fill }}>
        {little ? "I learned it!" : "Got it"}
      </button>
    </Card>
  );
}
