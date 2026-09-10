# CourseForge

An AI course studio. Give it a brief — what the course teaches, who it is for,
how long it should run — and it writes the whole course: the outline, the
lesson scripts with narration and slides, the visual direction, the knowledge
checks, and the final assessment. Then it publishes: a self-contained course
player you can open in a browser, and a SCORM 1.2 package you can upload to an
LMS.

You can also point it at your own material. Paste a handbook, a runbook, a
transcript or a set of slide notes, and the course is written from that rather
than from the model's general knowledge.

## What comes out

Every course exports four ways, and every one of them is self-contained:

| Export | What it is |
| --- | --- |
| **SCORM 1.2 package** (`.zip`) | Upload to an LMS. Reports completion and quiz score back through the SCORM API. |
| **Standalone player** (`.html`) | One file. Open it in any browser — slides, narrated playback, quizzes, progress. No server, no network. |
| **Production script** (`.md`) | The narration, on-screen text, visual direction and answer keys, for a human to film or edit from. |
| **Course data** (`.json`) | The structured course, for pushing into your own systems. |

The player speaks the narration using the browser's own speech synthesis and
advances scene by scene, so a generated script plays back as a lesson rather
than sitting on the page as text. Learner progress and quiz scores persist
locally, and inside an LMS the same file reports them upstream.

## Getting started

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run dev               # studio on http://localhost:5173
```

`npm run dev` runs the API and the Vite dev server together. For a production
run, `npm run build && npm start` serves the built studio and the API from a
single process on port 5174.

Without an API key CourseForge still runs, using an offline mock generator. It
produces structurally complete courses — real scene counts, real quiz shapes —
so you can exercise the studio, the player and every export without spending
anything. The prose is placeholder and says so; it is scaffolding, not
teaching.

## From the command line

```bash
# Build a course and write every export
npx course-forge build \
  --topic "Writing incident postmortems that people actually read" \
  --audience "On-call backend engineers at a mid-size SaaS company" \
  --level intermediate --minutes 45 --modules 3

# Teach from your own material instead of general knowledge
npx course-forge build --topic "Our deploy process" --audience "New hires" \
  --source ./handbook.md

npx course-forge demo      # build a sample course end to end
npx course-forge list      # what has been built
npx course-forge export <course-id> --out ./exports
```

## How a course gets built

The build runs in stages, and each stage sees the finished output of the last:

1. **Blueprint** — the course title, outcomes, prerequisites, and a module and
   lesson structure sized to the runtime target.
2. **Lessons** — each lesson written against the finished blueprint, as ordered
   scenes: a slide heading, on-screen bullets, the narration spoken over it,
   and direction for the visual.
3. **Assessments** — a knowledge check per module and a final assessment,
   written against the lessons *as they came out*, not against their titles.
   This is what stops the quiz testing material the course never covered.

Every stage is a single Claude request constrained by a JSON Schema through
[structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs),
so the response is valid course data or an error — never prose to be parsed
out. Responses are streamed, and the studio shows the build happening stage by
stage over a server-sent-event connection.

Nothing downstream trusts the model's output verbatim: everything is coerced,
clamped and filtered on the way in, so a malformed response degrades into a
thin course rather than a crash in the exporter. Quiz questions with fewer than
two options are dropped; scenes with neither narration nor bullets are dropped;
runtimes are recomputed from the narration that was actually written.

Builds resume rather than restart. Running a build again writes only what is
missing — an outline you have edited by hand is never silently re-planned, and
lessons you have edited are not thrown away. "Rebuild from scratch" is the
explicit way to start over.

Source material you paste is delimited and labelled in the prompt as reference
content to teach from, never as instructions to follow.

## The studio

- **Script** — pick any lesson and edit its scenes: headings, on-screen
  bullets, narration, visual direction. Save, or have a lesson rewritten.
- **Assessments** — every knowledge check and the final, with answer keys.
- **Preview** — the real exported player, embedded, exactly as a learner sees it.
- **Export** — all four formats, plus the token usage of the last build.

## Configuration

All optional; see `.env.example` for the full list.

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Without it, the offline mock generator is used |
| `COURSE_FORGE_MODEL` | `claude-opus-5` | Which model writes the courses |
| `COURSE_FORGE_EFFORT` | `high` | How hard it works per request: `low` … `max` |
| `COURSE_FORGE_PROVIDER` | auto | Force `anthropic` or `mock` |
| `COURSE_FORGE_MAX_TOKENS` | `16000` | Ceiling per lesson or quiz response |
| `COURSE_FORGE_DATA_DIR` | `./data/courses` | Where courses are stored |
| `PORT` | `5174` | API and built-studio port |

## Project layout

```
server/
  index.js          HTTP server: API plus the built studio
  routes.js         REST endpoints and the SSE generation stream
  pipeline.js       Stage-by-stage course build
  store.js          One JSON file per course, atomic and serialized writes
  cli.js            Headless builds and exports
  ai/
    anthropic.js    Structured-output calls to Claude
    mock.js         Offline generator, no key required
    prompts.js      The instructional-design system prompt and stage prompts
    schemas.js      JSON Schemas the responses are pinned to
  export/
    html.js         The self-contained player document
    markdown.js     The production script
    scorm.js        SCORM 1.2 manifest and package
    zip.js          Minimal zip writer
    player/         The player's own CSS and runtime, inlined at export
src/                The studio (React)
tests/              node --test
```

## Testing

```bash
npm test        # unit, pipeline, export and HTTP tests — no API key needed
npx oxlint      # lint
npm run build   # production build of the studio
```

The suite runs entirely against the mock generator and a fake API client, so it
needs no credentials and makes no network calls.

## A note on what this does and does not do

CourseForge writes courses; it does not film them. Every scene carries visual
direction for whoever produces the picture, and the player narrates with the
browser's speech synthesis rather than a synthetic presenter. If you need
avatar video, take the `.md` production script into the tool that makes it.

Generated courses are drafts. Read one before you put it in front of learners —
particularly the assessments, where a plausible-sounding wrong answer is the
whole point and a wrong right answer is easy to miss.
