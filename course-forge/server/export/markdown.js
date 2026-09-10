/**
 * The course as a Markdown workbook: the production script an author edits
 * and a producer films from, with narration, on-screen text, visual
 * direction, and answer keys.
 */
export function renderCourseMarkdown(course) {
  const out = []
  const add = (...lines) => out.push(...lines)

  add(`# ${course.title}`, '')
  if (course.subtitle) add(`*${course.subtitle}*`, '')
  if (course.summary) add(course.summary, '')

  const totalMinutes = course.modules.reduce(
    (total, module) => total + module.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
    0,
  )
  add(
    `**Audience:** ${course.brief.audience}  `,
    `**Level:** ${course.brief.level}  `,
    `**Runtime:** ~${totalMinutes} minutes across ${course.modules.length} modules`,
    '',
  )

  if (course.outcomes.length) {
    add('## What learners will be able to do', '')
    course.outcomes.forEach((outcome) => add(`- ${outcome}`))
    add('')
  }
  if (course.prerequisites.length) {
    add('## Prerequisites', '')
    course.prerequisites.forEach((item) => add(`- ${item}`))
    add('')
  }

  course.modules.forEach((module, moduleIndex) => {
    add('---', '', `## Module ${moduleIndex + 1}: ${module.title}`, '')
    if (module.summary) add(module.summary, '')
    if (module.objectives.length) {
      add('**Objectives**', '')
      module.objectives.forEach((objective) => add(`- ${objective}`))
      add('')
    }

    module.lessons.forEach((lesson, lessonIndex) => {
      add(`### ${moduleIndex + 1}.${lessonIndex + 1} ${lesson.title} *(${lesson.minutes} min)*`, '')
      if (lesson.summary) add(lesson.summary, '')

      lesson.scenes.forEach((scene, sceneIndex) => {
        add(`#### Scene ${sceneIndex + 1} — ${scene.heading} *(${scene.seconds}s)*`, '')
        if (scene.bullets.length) {
          add('**On screen**', '')
          scene.bullets.forEach((bullet) => add(`- ${bullet}`))
          add('')
        }
        if (scene.visual) add(`**Visual:** ${scene.visual}`, '')
        if (scene.narration) add('**Narration**', '', `> ${scene.narration.replace(/\n+/g, '\n> ')}`, '')
      })

      if (lesson.takeaways.length) {
        add('**Takeaways**', '')
        lesson.takeaways.forEach((takeaway) => add(`- ${takeaway}`))
        add('')
      }
      if (lesson.glossary.length) {
        add('**Glossary**', '')
        lesson.glossary.forEach((entry) => add(`- **${entry.term}** — ${entry.definition}`))
        add('')
      }
    })

    if (module.quiz.questions.length) {
      add(`### Knowledge check: ${module.title}`, '')
      add(...renderQuestions(module.quiz.questions))
    }
  })

  if (course.finalAssessment.questions.length) {
    add('---', '', '## Final assessment', '')
    add(...renderQuestions(course.finalAssessment.questions))
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

function renderQuestions(questions) {
  const out = []
  questions.forEach((question, index) => {
    out.push(`**${index + 1}. ${question.stem}**`, '')
    question.options.forEach((option, optionIndex) => {
      out.push(`${String.fromCharCode(97 + optionIndex)}) ${option}`)
    })
    out.push('')
    const answer = String.fromCharCode(97 + question.answerIndex)
    out.push(`*Answer: ${answer}. ${question.explanation}*`, '')
  })
  return out
}
