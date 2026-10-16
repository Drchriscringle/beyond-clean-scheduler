import { useEffect, useMemo, useState } from "react";
import * as icons from "lucide-react";
import { X, Check, Star, RotateCcw, ChevronRight, Play, Delete } from "lucide-react";
import { useMoney, useCurrencyCode } from "../../hooks/useCurrency";
import { GAMES, gamesFor, dailyGame, coinsFor, coinRounds, fewestCoins, needWantRounds, jarRounds, valueRounds } from "../../lib/games";
import { JARS } from "../Jars";
import { playTap, playCoinShower, playFanfare } from "../../lib/sound";
import { Card, Button } from "../ui";

const STARS_PREFIX = "pm_game_stars_";
function readStars(kidId) {
  try {
    return Number(localStorage.getItem(STARS_PREFIX + kidId) || 0);
  } catch {
    return 0;
  }
}
function addStars(kidId, n) {
  try {
    localStorage.setItem(STARS_PREFIX + kidId, String(readStars(kidId) + n));
  } catch {
    // ignore
  }
}

function GameIcon({ name, size = 22 }) {
  const Icon = icons[name] || icons.Gamepad2;
  return <Icon size={size} aria-hidden />;
}

// Learn section launcher: today's game up front, the rest a tap away.
export function MoneyGamesCard({ kid, mode, color }) {
  const little = mode === "little";
  const today = dailyGame(mode, kid.id);
  const [playing, setPlaying] = useState(null);
  const [stars, setStars] = useState(() => readStars(kid.id));
  const others = gamesFor(mode).filter((g) => g.key !== today.key);

  return (
    <>
      <Card className={little ? "p-5" : "p-4"} accent={color.fill}>
        <div className="flex items-center gap-3">
          <span className={`${little ? "h-14 w-14" : "h-11 w-11"} rounded-2xl flex items-center justify-center shrink-0 text-white`} style={{ background: color.fill }}>
            <GameIcon name={today.icon} size={little ? 28 : 22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted">Today's game</div>
            <div className={`${little ? "text-[20px]" : "text-[17px]"} font-bold text-ink tracking-tight`}>{today.title}</div>
            <div className={`${little ? "text-[14px]" : "text-[12.5px]"} text-ink-muted`}>{today.blurb}</div>
          </div>
          {stars > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-[12px] font-bold tabular-nums shrink-0">
              <Star size={13} className="fill-current" /> {stars}
            </span>
          )}
        </div>
        <Button className={`w-full mt-3 ${little ? "h-12 text-[15px]" : ""}`} style={{ background: color.fill }} onClick={() => setPlaying(today)}>
          <Play size={17} /> Play
        </Button>
        {others.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {others.map((g) => (
              <button key={g.key} onClick={() => setPlaying(g)} className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 h-9 text-[12.5px] font-semibold text-ink hover:bg-surface">
                <span style={{ color: color.main }}><GameIcon name={g.icon} size={14} /></span> {g.title}
              </button>
            ))}
          </div>
        )}
      </Card>
      {playing && (
        <GameSheet
          game={playing}
          kid={kid}
          mode={mode}
          color={color}
          onClose={() => setPlaying(null)}
          onEarned={(n) => {
            addStars(kid.id, n);
            setStars(readStars(kid.id));
          }}
        />
      )}
    </>
  );
}

/* ---------------- shared game frame ---------------- */

function GameSheet({ game, kid, mode, color, onClose, onEarned }) {
  const [round, setRound] = useState(0); // bump to restart
  const [result, setResult] = useState(null); // { correct, total }
  const little = mode === "little";

  const finish = (correct, total) => {
    setResult({ correct, total });
    const earned = correct === total ? 3 : correct >= Math.ceil(total / 2) ? 2 : 1;
    onEarned(earned);
    if (correct === total) playFanfare();
    else playCoinShower(6, 0.6);
  };

  const Body = { needwant: NeedOrWant, coins: MakeTheMoney, jars: WhichJar, value: BestDeal }[game.key];

  return (
    <div className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-md h-[92dvh] sm:h-auto sm:max-h-[88vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={game.title}>
        <header className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: color.fill }}><GameIcon name={game.icon} size={18} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink truncate">{game.title}</div>
            <div className="text-[12px] text-ink-muted">{game.blurb}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {result ? (
            <Results {...result} little={little} color={color} name={kid.name} onAgain={() => { setResult(null); setRound((r) => r + 1); }} onClose={onClose} />
          ) : (
            <Body key={round} mode={mode} color={color} little={little} onFinish={finish} />
          )}
        </div>
      </div>
    </div>
  );
}

function Progress({ n, total, color }) {
  return (
    <div className="flex gap-1.5 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className="h-1.5 flex-1 rounded-full transition" style={{ background: i < n ? color.main : "#e9ebf2" }} />
      ))}
    </div>
  );
}

// Flash of feedback between rounds, then move on.
function useRoundFlow(total, onFinish) {
  const [i, setI] = useState(0);
  const [feedback, setFeedback] = useState(null); // { ok, note }
  const [correct, setCorrect] = useState(0);
  const answer = (ok, note) => {
    if (feedback) return;
    if (ok) playCoinShower(4, 0.4);
    else playTap();
    setFeedback({ ok, note });
    const nextCorrect = correct + (ok ? 1 : 0);
    setCorrect(nextCorrect);
    setTimeout(() => {
      setFeedback(null);
      if (i + 1 >= total) onFinish(nextCorrect, total);
      else setI(i + 1);
    }, ok ? 900 : 1500);
  };
  return { i, feedback, answer };
}

function Feedback({ feedback, little }) {
  if (!feedback) return null;
  return (
    <div className={`tip-in mt-3 rounded-xl px-3.5 py-2.5 ${little ? "text-[15px]" : "text-[13.5px]"} font-semibold ${feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
      {feedback.ok ? "Yes! " : "Not quite. "}{feedback.note}
    </div>
  );
}

function BigChoice({ children, onClick, tone, little, disabled }) {
  const tones = { need: "#15803d", want: "#c2410c", save: "#15803d", spend: "#1d6fe8", give: "#be185d", a: "#5b2fa8", b: "#0e7490" };
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-2xl text-white font-bold transition active:scale-[0.97] disabled:opacity-70 ${little ? "h-16 text-[18px]" : "h-13 text-[15px]"}`} style={{ background: tones[tone] || "#5b2fa8" }}>
      {children}
    </button>
  );
}

/* ---------------- Need or Want? ---------------- */

function NeedOrWant({ mode, color, little, onFinish }) {
  const rounds = useMemo(() => needWantRounds(mode, Date.now(), 6), [mode]);
  const { i, feedback, answer } = useRoundFlow(rounds.length, onFinish);
  const r = rounds[i];
  const pick = (choice) => answer(choice === r.answer, r.answer === "need" ? `${r.label} is something you can't do without.` : `${r.label} is nice to have, but you'd be fine without it.`);
  return (
    <div>
      <Progress n={i} total={rounds.length} color={color} />
      <p className={`${little ? "text-[16px]" : "text-[14px]"} text-ink-muted`}>Is this a <strong className="text-ink">need</strong> or a <strong className="text-ink">want</strong>?</p>
      <div className="mt-4 rounded-2xl bg-surface p-6 flex flex-col items-center gap-3 text-center">
        <span className="h-20 w-20 rounded-3xl bg-white flex items-center justify-center shadow-sm" style={{ color: color.main }}><GameIcon name={r.icon} size={40} /></span>
        <div className={`${little ? "text-[24px]" : "text-[20px]"} font-bold text-ink`}>{r.label}</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <BigChoice tone="need" little={little} disabled={!!feedback} onClick={() => pick("need")}>Need</BigChoice>
        <BigChoice tone="want" little={little} disabled={!!feedback} onClick={() => pick("want")}>Want</BigChoice>
      </div>
      <Feedback feedback={feedback} little={little} />
    </div>
  );
}

/* ---------------- Which jar? ---------------- */

function WhichJar({ mode, color, little, onFinish }) {
  const rounds = useMemo(() => jarRounds(mode, Date.now(), 6), [mode]);
  const { i, feedback, answer } = useRoundFlow(rounds.length, onFinish);
  const r = rounds[i];
  const labels = { save: "Save — it's for later or for a rainy day.", spend: "Spend — it's something for now.", give: "Give — it's helping someone else." };
  return (
    <div>
      <Progress n={i} total={rounds.length} color={color} />
      <p className={`${little ? "text-[16px]" : "text-[14px]"} text-ink-muted`}>Which jar does this money come from?</p>
      <div className="mt-4 rounded-2xl bg-surface p-5 text-center">
        <div className={`${little ? "text-[20px]" : "text-[17px]"} font-bold text-ink leading-snug`}>{r.text}</div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {JARS.map((j) => (
          <BigChoice key={j.key} tone={j.key} little={little} disabled={!!feedback} onClick={() => answer(j.key === r.answer, labels[r.answer])}>{j.label}</BigChoice>
        ))}
      </div>
      <Feedback feedback={feedback} little={little} />
    </div>
  );
}

/* ---------------- Make the money ---------------- */

function MakeTheMoney({ mode, color, little, onFinish }) {
  const money = useMoney();
  const currency = useCurrencyCode();
  const coins = useMemo(() => coinsFor(currency, mode), [currency, mode]);
  const rounds = useMemo(() => coinRounds(mode, coins, Date.now(), 5), [mode, coins]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState([]);
  const [correct, setCorrect] = useState(0);
  const [note, setNote] = useState(null);
  const [shake, setShake] = useState(false);
  const target = rounds[i];
  const total = picked.reduce((s, c) => s + c, 0);
  const best = fewestCoins(target, coins);

  useEffect(() => {
    if (total === 0 || note) return;
    if (total === target) {
      const perfect = picked.length === best;
      playCoinShower(5, 0.5);
      setNote(perfect ? "Perfect — the fewest coins!" : `Right! You could do it with ${best} coins.`);
      const nextCorrect = correct + 1;
      setCorrect(nextCorrect);
      setTimeout(() => {
        setNote(null);
        setPicked([]);
        if (i + 1 >= rounds.length) onFinish(nextCorrect, rounds.length);
        else setI(i + 1);
      }, 1200);
    } else if (total > target) {
      playTap();
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPicked([]);
      }, 450);
    }
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <Progress n={i} total={rounds.length} color={color} />
      <p className={`${little ? "text-[16px]" : "text-[14px]"} text-ink-muted`}>Tap coins to make exactly</p>
      <div className={`mt-2 rounded-2xl p-5 text-center text-white ${shake ? "animate-shake" : ""}`} style={{ background: color.fill }}>
        <div className={`${little ? "text-[44px]" : "text-[36px]"} font-bold tabular-nums leading-none`}>{money(target)}</div>
        <div className="mt-2 text-[13px] text-white/80 tabular-nums">So far: <strong className="text-white">{money(total)}</strong>{total > 0 && total < target ? ` · ${money(target - total)} to go` : ""}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {coins.map((c) => (
          <button
            key={c}
            onClick={() => { playTap(); setPicked((p) => [...p, c]); }}
            disabled={!!note}
            className={`rounded-full font-bold text-[13px] tabular-nums shadow-[inset_0_-2px_0_rgba(0,0,0,0.15),0_3px_8px_rgba(201,138,0,0.3)] transition active:scale-95 ${little ? "h-16 w-16 text-[15px]" : "h-14 w-14"}`}
            style={{ background: c >= 100 ? "radial-gradient(circle at 35% 30%, #fff1b8 0%, #e2b23a 55%, #a7751a 100%)" : c >= 5 ? "radial-gradient(circle at 35% 30%, #f4f4f4 0%, #c9c9c9 55%, #8f8f8f 100%)" : "radial-gradient(circle at 35% 30%, #f6c6a5 0%, #c57a4a 55%, #8a4d27 100%)", color: "#2b1d0e" }}
          >
            {money(c).replace(/\.00$/, "")}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 min-h-8">
        {picked.length > 0 && !note && (
          <button onClick={() => setPicked((p) => p.slice(0, -1))} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 h-8 text-[12.5px] font-semibold text-ink"><Delete size={14} /> Undo</button>
        )}
        {picked.length > 0 && !note && (
          <button onClick={() => setPicked([])} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 h-8 text-[12.5px] font-semibold text-ink"><RotateCcw size={14} /> Clear</button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 justify-center min-h-6">
        {picked.map((c, k) => <span key={k} className="rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-[11px] font-semibold tabular-nums">{money(c).replace(/\.00$/, "")}</span>)}
      </div>
      {note && <div className="tip-in mt-3 rounded-xl bg-emerald-50 text-emerald-800 px-3.5 py-2.5 text-[14px] font-semibold text-center">{note}</div>}
      {shake && <div className="mt-3 rounded-xl bg-amber-50 text-amber-800 px-3.5 py-2.5 text-[13.5px] font-semibold text-center">Too much! Start again.</div>}
    </div>
  );
}

/* ---------------- Best deal ---------------- */

function BestDeal({ color, little, onFinish }) {
  const money = useMoney();
  const rounds = useMemo(() => valueRounds(Date.now(), 5), []);
  const { i, feedback, answer } = useRoundFlow(rounds.length, onFinish);
  const r = rounds[i];
  const note = `${r.better === "a" ? r.a.label : r.b.label} works out at ${money(r.better === "a" ? r.unitA : r.unitB)} per ${r.per}, against ${money(r.better === "a" ? r.unitB : r.unitA)}.`;
  return (
    <div>
      <Progress n={i} total={rounds.length} color={color} />
      <p className="text-[14px] text-ink-muted">Which is better value per {r.per}?</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {["a", "b"].map((side) => (
          <button key={side} onClick={() => answer(side === r.better, note)} disabled={!!feedback} className="rounded-2xl border-2 border-line bg-white p-4 text-left transition active:scale-[0.98] hover:bg-surface disabled:opacity-80">
            <div className="text-[15px] font-bold text-ink">{r[side].label}</div>
            <div className="text-[22px] font-bold tabular-nums mt-1" style={{ color: color.main }}>{money(r[side].pence)}</div>
            <div className="text-[12px] text-ink-muted mt-1 inline-flex items-center gap-1">Pick <ChevronRight size={12} /></div>
          </button>
        ))}
      </div>
      <Feedback feedback={feedback} little={little} />
    </div>
  );
}

/* ---------------- results ---------------- */

function Results({ correct, total, little, color, name, onAgain, onClose }) {
  const all = correct === total;
  const stars = all ? 3 : correct >= Math.ceil(total / 2) ? 2 : 1;
  return (
    <div className="text-center py-4">
      <div className="flex justify-center gap-1.5">
        {[0, 1, 2].map((n) => <Star key={n} size={little ? 40 : 32} className={n < stars ? "text-amber-400 fill-amber-400" : "text-line"} />)}
      </div>
      <h3 className={`${little ? "text-[26px]" : "text-[22px]"} font-bold text-ink tracking-tight mt-3`}>{all ? `Amazing, ${name}!` : stars === 2 ? "Nice work!" : "Good try!"}</h3>
      <p className={`${little ? "text-[16px]" : "text-[14px]"} text-ink-muted mt-1`}>You got {correct} out of {total}.{all ? " Full marks!" : " Have another go to get them all."}</p>
      <div className="mt-6 flex gap-2">
        <Button className="flex-1" style={{ background: color.fill }} onClick={onAgain}><RotateCcw size={16} /> Play again</Button>
        <Button variant="ghost" onClick={onClose}><Check size={16} /> Done</Button>
      </div>
    </div>
  );
}

export { GAMES };
