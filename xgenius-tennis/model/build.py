"""Build xGenius Tennis forecasts.

Downloads ATP and WTA results, rates every player with a surface-aware Elo
model, scores each 2026 forecast against the result (made before the match,
using only earlier matches) and writes site/data.json for the website.

Usage:  python3 model/build.py            # download, then build
        python3 model/build.py --offline  # use files already in model/raw/
"""

import csv
import json
import math
import sys
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT.parent / "site" / "data.json"

SOURCE = "https://huggingface.co/datasets/minmaxxxer/atp-wta-matches-with-odds/resolve/main/{tour}_matches_{year}.csv"
SOURCE_PAGE = "https://huggingface.co/datasets/minmaxxxer/atp-wta-matches-with-odds"
TOURS = ("atp", "wta")
YEARS = (2025, 2026)
TEST_YEAR = 2026

SURFACES = ("Hard", "Clay", "Grass")
ROUND_ORDER = {"Q1": 0, "Q2": 1, "Q3": 2, "R128": 3, "R64": 4, "R32": 5, "R16": 6, "RR": 6, "QF": 7, "SF": 8, "BR": 8, "F": 9}
SURFACE_WEIGHT = 0.5      # share of the surface rating in a match forecast
RECENT_DAYS = 14          # matches shown on "We said. It finished."
ACTIVE_SINCE_DAYS = 120   # players listed in rankings and the calculator
MIN_MATCHES = 8


# ---------- data ----------

def download():
    RAW.mkdir(exist_ok=True)
    for tour in TOURS:
        for year in YEARS:
            dest = RAW / f"{tour}_matches_{year}.csv"
            print(f"downloading {dest.name}")
            urllib.request.urlretrieve(SOURCE.format(tour=tour, year=year), dest)


def load(tour):
    rows = []
    for year in YEARS:
        with open(RAW / f"{tour}_matches_{year}.csv", newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                score = r["score"] or ""
                if "W/O" in score or not r["winner_id"] or not r["loser_id"]:
                    continue
                rows.append(r)
    rows.sort(key=lambda r: (r["start_time_utc"] or r["tourney_date"], ROUND_ORDER.get(r["round"], 5), int(r["match_num"] or 0)))
    return rows


def display_name(raw):
    """'Davidovich Fokina A.' -> 'A. Davidovich Fokina'."""
    parts = raw.split()
    initials = [p for p in parts if p.endswith(".")]
    surname = [p for p in parts if not p.endswith(".")]
    return " ".join(initials[:1] + surname) if initials and surname else raw


def match_day(r):
    if r["start_time_utc"]:
        return r["start_time_utc"][:10]
    d = r["tourney_date"]
    return f"{d[:4]}-{d[4:6]}-{d[6:]}"


# ---------- maths ----------

def elo_prob(a, b):
    return 1 / (1 + 10 ** ((b - a) / 400))


def k_factor(n):
    return 250 / (n + 5) ** 0.4


def set_prob_from_bo3(p):
    """Chance of winning a set, given the chance of winning a best-of-3 match."""
    lo, hi = 0.0, 1.0
    for _ in range(60):
        s = (lo + hi) / 2
        if s * s * (3 - 2 * s) < p:
            lo = s
        else:
            hi = s
    return (lo + hi) / 2


def set_scores(p_bo3, best_of):
    """Probabilities of each set score from player A's side."""
    s = set_prob_from_bo3(p_bo3)
    t = 1 - s
    if best_of == 5:
        return {"3-0": s**3, "3-1": 3 * s**3 * t, "3-2": 6 * s**3 * t**2,
                "2-3": 6 * s**2 * t**3, "1-3": 3 * s * t**3, "0-3": t**3}
    return {"2-0": s**2, "2-1": 2 * s**2 * t, "1-2": 2 * s * t**2, "0-2": t**2}


def win_prob(scores):
    return sum(v for k, v in scores.items() if int(k[0]) > int(k[2]))


def sets_won(score):
    w = l = 0
    for part in score.replace("RET", "").split():
        games = part.split("(")[0].split("-")
        if len(games) != 2 or not games[0].isdigit() or not games[1].isdigit():
            continue
        a, b = int(games[0]), int(games[1])
        if a > b:
            w += 1
        elif b > a:
            l += 1
    return w, l


def seed_rating(rank):
    """Starting rating for a player we haven't seen, from their world ranking."""
    try:
        rank = int(float(rank))
    except (TypeError, ValueError):
        return 1400
    return 2100 - 150 * math.log(max(rank, 1))


# ---------- model ----------

class Ratings:
    def __init__(self):
        self.overall = {}
        self.surface = defaultdict(dict)
        self.n = defaultdict(int)
        self.ns = defaultdict(int)

    def ensure(self, pid, rank):
        if pid not in self.overall:
            seed = seed_rating(rank)
            self.overall[pid] = seed
            for s in SURFACES:
                self.surface[s][pid] = seed
            self.n[pid] = 10

    def blended(self, pid, surface):
        o = self.overall[pid]
        if surface not in SURFACES:
            return o
        return (1 - SURFACE_WEIGHT) * o + SURFACE_WEIGHT * self.surface[surface][pid]

    def update(self, w, l, surface):
        p = elo_prob(self.overall[w], self.overall[l])
        kw, kl = k_factor(self.n[w]), k_factor(self.n[l])
        self.overall[w] += kw * (1 - p)
        self.overall[l] -= kl * (1 - p)
        self.n[w] += 1
        self.n[l] += 1
        if surface in SURFACES:
            sr = self.surface[surface]
            p = elo_prob(sr[w], sr[l])
            kw, kl = k_factor(self.ns[(w, surface)]), k_factor(self.ns[(l, surface)])
            sr[w] += kw * (1 - p)
            sr[l] -= kl * (1 - p)
            self.ns[(w, surface)] += 1
            self.ns[(l, surface)] += 1


def run_tour(tour):
    rows = load(tour)
    R = Ratings()
    names, ioc, last_seen, form, played = {}, {}, {}, defaultdict(list), defaultdict(int)
    tests = []

    for r in rows:
        w, l, surface = r["winner_id"], r["loser_id"], r["surface"]
        R.ensure(w, r["winner_rank"])
        R.ensure(l, r["loser_rank"])
        best_of = 5 if r["best_of"] == "5" else 3
        day = match_day(r)

        # Forecast made before the match, from the winner's side.
        p3 = elo_prob(R.blended(w, surface), R.blended(l, surface))
        scores = set_scores(p3, best_of)
        p = win_prob(scores)
        retired = "RET" in (r["score"] or "")
        if day.startswith(str(TEST_YEAR)) and not retired:
            ws, ls = sets_won(r["score"])
            fav_is_winner = p >= 0.5
            fav_scores = scores if fav_is_winner else {k[::-1]: v for k, v in scores.items()}
            tests.append({
                "day": day, "tourney": r["tourney_name"], "level": r["tourney_level"], "round": r["round"], "surface": surface,
                "w": w, "l": l, "p": p,
                "pick": max(fav_scores, key=fav_scores.get),
                "actual": f"{ws}-{ls}" if fav_is_winner else f"{ls}-{ws}",
                "score": r["score"],
                "market": float(r["winner_close_prob"]) if r["winner_close_prob"] else None,
            })

        R.update(w, l, surface)
        for pid, name, country, res in ((w, r["winner_name"], r["winner_ioc"], "W"), (l, r["loser_name"], r["loser_ioc"], "L")):
            names[pid] = display_name(name)
            ioc[pid] = country
            last_seen[pid] = day
            form[pid] = (form[pid] + [res])[-10:]
            played[pid] += 1

    latest = max(last_seen.values())
    cutoff = (date.fromisoformat(latest) - timedelta(days=ACTIVE_SINCE_DAYS)).isoformat()
    players = []
    for pid in R.overall:
        if last_seen[pid] < cutoff or played[pid] < MIN_MATCHES:
            continue
        players.append({
            "id": pid, "name": names[pid], "ioc": ioc[pid],
            "all": round(R.overall[pid]),
            **{s.lower(): round(R.blended(pid, s)) for s in SURFACES},
            "form": "".join(form[pid]), "played": played[pid], "last": last_seen[pid],
        })
    players.sort(key=lambda x: -x["all"])

    return {"players": players, "names": names, "tests": tests, "latest": latest}


# ---------- scoring ----------

def summarise(tests, names):
    def ll(p):
        return -math.log(max(min(p, 1 - 1e-9), 1e-9))

    n = len(tests)
    hits = sum(t["p"] >= 0.5 for t in tests)
    logloss = sum(ll(t["p"]) for t in tests) / n
    brier = sum((1 - t["p"]) ** 2 for t in tests) / n
    exact = sum(t["pick"] == t["actual"] for t in tests)

    buckets = [(0.5, 0.6), (0.6, 0.7), (0.7, 0.8), (0.8, 0.9), (0.9, 1.01)]
    calib = []
    for lo, hi in buckets:
        b = [t for t in tests if lo <= max(t["p"], 1 - t["p"]) < hi]
        if b:
            calib.append({
                "label": f"{int(lo*100)}–{min(int(hi*100), 100)}%",
                "n": len(b),
                "said": round(100 * sum(max(t["p"], 1 - t["p"]) for t in b) / len(b), 1),
                "won": round(100 * sum(t["p"] >= 0.5 for t in b) / len(b), 1),
            })

    by_surface = {}
    for s in SURFACES:
        b = [t for t in tests if t["surface"] == s]
        if b:
            by_surface[s] = {"n": len(b), "right": sum(t["p"] >= 0.5 for t in b)}

    latest = max(t["day"] for t in tests)
    since = (date.fromisoformat(latest) - timedelta(days=RECENT_DAYS)).isoformat()
    recent = []
    for t in tests:
        if t["day"] < since:
            continue
        fav_won = t["p"] >= 0.5
        fav, dog = (t["w"], t["l"]) if fav_won else (t["l"], t["w"])
        recent.append({
            "day": t["day"], "tourney": t["tourney"], "round": t["round"], "surface": t["surface"],
            "fav": names[fav], "dog": names[dog], "chance": round(100 * max(t["p"], 1 - t["p"])),
            "right": fav_won, "pick": t["pick"], "actual": t["actual"], "score": t["score"],
        })
    recent.reverse()

    market = [t for t in tests if t["market"]]
    internal = {
        "matches_with_market": len(market),
        "model_logloss": round(sum(ll(t["p"]) for t in market) / len(market), 4),
        "market_logloss": round(sum(ll(t["market"]) for t in market) / len(market), 4),
    } if market else {}

    return {
        "n": n, "right": hits, "logloss": round(logloss, 4), "coin_logloss": round(math.log(2), 4),
        "brier": round(brier, 4), "exact_sets": exact,
        "calibration": calib, "by_surface": by_surface, "recent": recent,
    }, internal


def main():
    if "--offline" not in sys.argv:
        download()
    out = {
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "source": SOURCE_PAGE,
        "test_year": TEST_YEAR,
        "tours": {},
    }
    for tour in TOURS:
        res = run_tour(tour)
        check, internal = summarise(res["tests"], res["names"])
        out["tours"][tour.upper()] = {"latest": res["latest"], "players": res["players"], "check": check}
        print(f"{tour.upper()}: {check['n']} forecasts in {TEST_YEAR}, favourite won {check['right']} "
              f"({100*check['right']/check['n']:.1f}%), log-loss {check['logloss']} vs coin {check['coin_logloss']}, "
              f"exact set score {check['exact_sets']} ({100*check['exact_sets']/check['n']:.1f}%)")
        if internal:
            print(f"   internal only, not published: model log-loss {internal['model_logloss']} vs betting market "
                  f"{internal['market_logloss']} on {internal['matches_with_market']} matches")
        for c in check["calibration"]:
            print(f"   {c['label']:>8}: said {c['said']}%, won {c['won']}% (n={c['n']})")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
