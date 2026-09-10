import { createCourse, applyBlueprint, applyLesson, applyQuiz, applyFinalAssessment } from '../server/lib/course.js'

/** A small, fully written course — the fixture every exporter test renders. */
export function sampleCourse() {
  let course = createCourse({
    topic: 'Designing accessible data tables',
    audience: 'Front-end engineers',
    level: 'intermediate',
    durationMinutes: 30,
    moduleCount: 1,
  })

  course = applyBlueprint(course, {
    title: 'Designing accessible data tables',
    subtitle: 'For front-end engineers shipping admin dashboards',
    summary: 'A short course on tables that screen readers can actually navigate.',
    outcomes: ['Mark up a table header row so it is announced correctly'],
    prerequisites: ['Working knowledge of HTML'],
    modules: [
      {
        title: 'Table semantics',
        summary: 'The markup that makes a table navigable.',
        objectives: ['Use scope correctly'],
        lessons: [
          { title: 'Headers and scope', summary: 'Why scope matters.', minutes: 6, objectives: ['Apply scope'] },
          { title: 'Captions', summary: 'Naming a table.', minutes: 4, objectives: ['Write a caption'] },
        ],
      },
    ],
  })

  const [module] = course.modules
  course = applyLesson(course, module.id, module.lessons[0].id, {
    scenes: [
      {
        heading: 'What a screen reader hears',
        bullets: ['Row and column context', 'Announced on every cell'],
        narration: 'Turn on a screen reader and move through a table without headers, and every cell arrives without context.',
        visual: 'Screen recording of VoiceOver moving through an unmarked table.',
      },
      {
        heading: 'Adding scope',
        bullets: ['scope="col"', 'scope="row"'],
        narration: 'Adding scope to each header cell tells the browser which cells it governs.',
        visual: 'Side-by-side markup diff.',
      },
    ],
    takeaways: ['Every header cell needs a scope.'],
    glossary: [{ term: 'scope', definition: 'The attribute saying which cells a header applies to.' }],
  })

  course = applyLesson(course, module.id, module.lessons[1].id, {
    scenes: [
      {
        heading: 'Naming the table',
        bullets: ['One caption per table'],
        narration: 'A caption gives the table a name that is announced before its contents.',
        visual: 'Markup example.',
      },
    ],
    takeaways: ['Caption every data table.'],
    glossary: [],
  })

  course = applyQuiz(course, module.id, {
    questions: [
      {
        stem: 'A header cell spans a column. Which scope is correct?',
        options: ['scope="row"', 'scope="col"', 'scope="all"', 'no scope needed'],
        answerIndex: 1,
        explanation: 'scope="col" tells the browser the header governs the cells beneath it.',
      },
    ],
  })

  return applyFinalAssessment(course, {
    questions: [
      {
        stem: 'Which element names a table for assistive technology?',
        options: ['<label>', '<caption>', '<legend>', '<title>'],
        answerIndex: 1,
        explanation: '<caption> is the table-level name.',
      },
    ],
  })
}
