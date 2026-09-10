/**
 * A deterministic, offline stand-in for the Claude provider.
 *
 * It exists so the studio can be demoed, and every downstream stage tested,
 * without an API key or a network call. It writes structurally complete
 * courses — real scene counts, real quiz shapes — from the brief alone, so
 * the exporters and the player get exercised on realistic input. The prose is
 * scaffolding, not teaching; anything shipped to learners needs the real
 * provider.
 */

const SCENES_PER_LESSON = 4

export function createMockProvider() {
  async function generate({ kind, context }) {
    return { data: build(kind, context), usage: { model: 'mock', inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } }
  }
  return { name: 'mock', model: 'mock', generate }
}

function build(kind, context = {}) {
  switch (kind) {
    case 'blueprint':
      return blueprint(context.brief)
    case 'lesson':
      return lesson(context)
    case 'quiz':
      return quiz(context.module.title, context.questionCount, context.module.objectives)
    case 'final':
      return quiz(context.course.title, context.questionCount, context.course.outcomes)
    default:
      throw new Error(`Unknown generation kind: ${kind}`)
  }
}

function blueprint(brief) {
  const stages = [
    { name: 'Foundations', verb: 'Describe' },
    { name: 'Core practice', verb: 'Apply' },
    { name: 'Working with real cases', verb: 'Diagnose' },
    { name: 'Common failures', verb: 'Recover from' },
    { name: 'Going further', verb: 'Extend' },
    { name: 'Putting it together', verb: 'Ship' },
  ]
  const moduleCount = Math.min(brief.moduleCount, stages.length)
  const lessonsPerModule = Math.max(2, Math.round(brief.durationMinutes / (moduleCount * 8)))
  const minutes = Math.max(3, Math.round(brief.durationMinutes / (moduleCount * lessonsPerModule)))

  return {
    title: `${brief.topic}: a practical course`,
    subtitle: `For ${brief.audience} at ${brief.level} level`,
    summary: `A ${brief.durationMinutes}-minute course on ${brief.topic}, written for ${brief.audience}. It moves from first principles to applied practice, with a knowledge check after every module.`,
    outcomes: stages
      .slice(0, moduleCount)
      .map((stage) => `${stage.verb} the ${stage.name.toLowerCase()} of ${brief.topic}`),
    prerequisites: brief.level === 'beginner' ? ['None'] : [`Working familiarity with ${brief.topic}`],
    modules: stages.slice(0, moduleCount).map((stage, moduleIndex) => ({
      title: `${stage.name} of ${brief.topic}`,
      summary: `Module ${moduleIndex + 1} covers the ${stage.name.toLowerCase()} a practitioner needs before moving on.`,
      objectives: [`${stage.verb} the key ideas in ${stage.name.toLowerCase()}`, `Recognise where they break down`],
      lessons: Array.from({ length: lessonsPerModule }, (_, lessonIndex) => ({
        title: `${stage.name}, part ${lessonIndex + 1}`,
        summary: `Part ${lessonIndex + 1} of ${stage.name.toLowerCase()} in ${brief.topic}.`,
        minutes,
        objectives: [`${stage.verb} part ${lessonIndex + 1} of ${stage.name.toLowerCase()}`],
      })),
    })),
  }
}

function lesson({ course, module, lesson: target }) {
  const topic = course.brief.topic
  const shapes = [
    { heading: 'Where this bites', visual: 'Screen recording of the problem happening in a real tool.' },
    { heading: 'The idea', visual: 'Simple diagram: inputs on the left, outputs on the right.' },
    { heading: 'Doing it', visual: 'Step-by-step walkthrough, cursor visible.' },
    { heading: 'What goes wrong', visual: 'Side-by-side of the working and broken versions.' },
  ]
  return {
    scenes: shapes.slice(0, SCENES_PER_LESSON).map((shape, index) => ({
      heading: `${shape.heading}`,
      bullets: [`${topic} in context`, `Step ${index + 1} of the method`, 'What to watch for'],
      narration: `This is placeholder narration for "${target.title}" in the module "${module.title}". ${shape.heading} is where most people working on ${topic} get stuck, so we start there. Run this course with an Anthropic API key to replace this with a written script.`,
      visual: shape.visual,
    })),
    takeaways: [
      `${target.title} is about ${topic} in practice, not in theory.`,
      'Placeholder takeaway generated without a model.',
    ],
    glossary: [{ term: topic, definition: `The subject of this course, as scoped in "${course.title}".` }],
  }
}

function quiz(subject, questionCount, objectives = []) {
  const count = Math.max(1, questionCount)
  return {
    questions: Array.from({ length: count }, (_, index) => {
      const objective = objectives[index % Math.max(1, objectives.length)] ?? subject
      // Rotating the answer position keeps the mock honest: an exporter or
      // player that hardcodes "the first option is correct" will fail here.
      const answerIndex = index % 4
      const options = ['First option', 'Second option', 'Third option', 'Fourth option']
      options[answerIndex] = `The correct answer about ${subject}`
      return {
        stem: `Placeholder question ${index + 1} about ${objective}. Which option is correct?`,
        options,
        answerIndex,
        explanation: `Placeholder explanation. Generated offline without a model, so it tests nothing.`,
      }
    }),
  }
}
