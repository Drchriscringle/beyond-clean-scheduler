/**
 * JSON Schemas passed to the Messages API as `output_config.format`, which
 * constrains the response to valid JSON of exactly this shape. Every object
 * sets `additionalProperties: false` and lists every property in `required`,
 * which structured outputs requires.
 */

const stringList = (maxItems, description) => ({
  type: 'array',
  description,
  minItems: 1,
  maxItems,
  items: { type: 'string' },
})

export const blueprintSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'subtitle', 'summary', 'outcomes', 'prerequisites', 'modules'],
  properties: {
    title: { type: 'string', description: 'Course title. Specific and benefit-led, under 70 characters.' },
    subtitle: { type: 'string', description: 'One clause naming who this is for and what they will be able to do.' },
    summary: {
      type: 'string',
      description: 'Two or three sentences of course description, written for a course catalogue page.',
    },
    outcomes: stringList(8, 'Learning outcomes. Each starts with an observable verb ("Configure", "Diagnose"), never "Understand" or "Learn about".'),
    prerequisites: stringList(6, 'What a learner must already know or have installed. Use ["None"] if there are none.'),
    modules: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'summary', 'objectives', 'lessons'],
        properties: {
          title: { type: 'string' },
          summary: { type: 'string', description: 'One or two sentences on what this module covers and why it comes here.' },
          objectives: stringList(5, 'Module objectives, each observable and assessable.'),
          lessons: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'summary', 'minutes', 'objectives'],
              properties: {
                title: { type: 'string' },
                summary: { type: 'string', description: 'One sentence on what this lesson teaches.' },
                minutes: { type: 'integer', description: 'Planned runtime in minutes, between 3 and 20.' },
                objectives: stringList(3, 'What the learner can do after this single lesson.'),
              },
            },
          },
        },
      },
    },
  },
}

export const lessonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['scenes', 'takeaways', 'glossary'],
  properties: {
    scenes: {
      type: 'array',
      minItems: 3,
      maxItems: 12,
      description: 'Ordered scenes. Each is one slide plus the narration spoken over it.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'bullets', 'narration', 'visual'],
        properties: {
          heading: { type: 'string', description: 'Slide heading, under 60 characters.' },
          bullets: {
            type: 'array',
            minItems: 0,
            maxItems: 5,
            description: 'On-screen bullets. Fragments, not sentences, and never a transcript of the narration.',
            items: { type: 'string' },
          },
          narration: {
            type: 'string',
            description:
              'What the presenter says over this slide: 60-140 words of spoken prose, no bullet markers, no stage directions.',
          },
          visual: {
            type: 'string',
            description:
              'Art direction for whoever produces the visual: the diagram, screen recording, or B-roll that should fill the slide.',
          },
        },
      },
    },
    takeaways: stringList(5, 'What the learner should remember tomorrow. Full sentences.'),
    glossary: {
      type: 'array',
      minItems: 0,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['term', 'definition'],
        properties: {
          term: { type: 'string' },
          definition: { type: 'string', description: 'One sentence, in plain language.' },
        },
      },
    },
  },
}

export const quizSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['stem', 'options', 'answerIndex', 'explanation'],
        properties: {
          stem: {
            type: 'string',
            description: 'The question. Poses a situation the learner must reason about, not a term to recall.',
          },
          options: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            description:
              'Four answers. The three wrong ones are plausible misconceptions a real learner holds, similar in length and specificity to the right one.',
            items: { type: 'string' },
          },
          answerIndex: { type: 'integer', description: 'Zero-based index of the correct option. Vary it across questions.' },
          explanation: {
            type: 'string',
            description: 'Why the right answer is right and why the tempting wrong one is wrong.',
          },
        },
      },
    },
  },
}
