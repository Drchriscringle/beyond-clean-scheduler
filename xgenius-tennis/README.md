# xGenius Tennis

A working prototype of a tennis version of xGenius: a forecast for every ATP and WTA tour-level match, and a public check of how the forecasts did.

## What's here

- `model/build.py` downloads the results, rates every player and writes `site/data.json`. It uses only the Python standard library.
- `site/index.html` is the website, in the xGenius house style. It reads `data.json`, and has a match forecaster, the results check and rankings.

```
python3 model/build.py          # download results and rebuild the forecasts
python3 model/build.py --offline  # rebuild from files already in model/raw/
cd site && python3 -m http.server 8000   # then open http://localhost:8000
```

## How the forecasts work

- Each player has an Elo rating overall and one for each surface (hard, clay, grass). Big wins against strong players move it more. The rating moves faster for players with few matches.
- New players start from a rating based on their world ranking.
- A forecast blends the overall and surface ratings 50/50. The rating gap gives the chance of winning a best-of-3 match. From that we get the chance of winning a set, and then the chance of each set score, for best of 3 or best of 5.
- Every forecast for 2026 is made before the match using only earlier results (2025 is used to warm the ratings up). Walkovers are skipped, and retirements count for the ratings but not for the results check.
- The model uses the standard published Elo settings. Nothing was tuned on the 2026 results, so the results check is a fair test.

## 2026 results check (to 19 October)

| | ATP | WTA |
|---|---|---|
| Matches forecast | 2,487 | 2,427 |
| Favourite won | 62.9% | 64.7% |
| Log-loss (coin flip is 0.693) | 0.642 | 0.619 |
| Exact score in sets | 38.5% | 44.2% |

The chances are fairly honest up to 70%. Favourites we gave 70–90% won about 5–7 points less often than we said.

`build.py` also prints a comparison with the betting market's closing prices, for internal use only. The site never shows it. The market is better (log-loss about 0.58 v 0.64 for ATP), as expected for a ratings-only model.

## Data

Results come from [ATP & WTA Matches with Odds](https://huggingface.co/datasets/minmaxxxer/atp-wta-matches-with-odds) on Hugging Face, published under CC BY 4.0 and updated every Monday. It continues Jeff Sackmann's files, which went offline in 2026. The publisher scraped it from public results sites, so before selling a product on it, check the rights, or switch to tennis-data.co.uk. tennis-data.co.uk blocks downloads from cloud servers, so its files would need fetching from a home connection or with permission.

## Not built yet

- Upcoming fixtures and order of play. That needs a fixtures feed; the forecaster lets you pick any two players for now.
- Login, plans and payments. Reuse the xGenius Supabase and Stripe setup.
- A scheduled rebuild (for example a weekly or daily Netlify or GitHub Actions job running `build.py`).
