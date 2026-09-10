/*
 * The exported course player.
 *
 * Ships inside every HTML export and inside the SCORM package, so it must run
 * with no build step, no dependencies, and no network: the course itself is
 * embedded in the page as JSON. Narration is spoken with the browser's own
 * speech synthesis, which is what makes a generated script play back as a
 * lesson rather than sit on the page as text.
 */
;(function () {
  'use strict'

  var COURSE = window.__COURSE__
  var STORAGE_KEY = 'course-forge:' + COURSE.id
  var PASS_MARK = 0.7

  // ---------------------------------------------------------------- progress

  var state = load()

  function load() {
    var empty = { visited: {}, quizzes: {} }
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return empty
      var parsed = JSON.parse(raw)
      return {
        visited: parsed && parsed.visited ? parsed.visited : {},
        quizzes: parsed && parsed.quizzes ? parsed.quizzes : {},
      }
    } catch {
      // Private browsing, disabled storage, or corrupt data: the course still
      // plays, it just will not remember where the learner got to.
      return empty
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* not fatal */
    }
    scorm.report(progress())
  }

  function progress() {
    var lessons = flatten()
    var done = 0
    for (var i = 0; i < lessons.length; i += 1) {
      if (state.visited[lessons[i].lesson.id]) done += 1
    }
    var scores = []
    for (var key in state.quizzes) {
      if (Object.prototype.hasOwnProperty.call(state.quizzes, key)) scores.push(state.quizzes[key])
    }
    var scored = scores.filter(function (entry) { return entry.total > 0 })
    var correct = scored.reduce(function (sum, entry) { return sum + entry.correct }, 0)
    var total = scored.reduce(function (sum, entry) { return sum + entry.total }, 0)
    return {
      lessonsDone: done,
      lessonsTotal: lessons.length,
      ratio: lessons.length ? done / lessons.length : 0,
      score: total ? correct / total : null,
      quizzesTaken: scored.length,
    }
  }

  function flatten() {
    var out = []
    COURSE.modules.forEach(function (module, moduleIndex) {
      module.lessons.forEach(function (lesson, lessonIndex) {
        out.push({ module: module, moduleIndex: moduleIndex, lesson: lesson, lessonIndex: lessonIndex })
      })
    })
    return out
  }

  // ------------------------------------------------------------------- SCORM

  /*
   * SCORM 1.2 adapter. In a standalone export there is no LMS and every call
   * is a no-op; inside an LMS the same player reports completion and score.
   */
  var scorm = (function () {
    var api = null
    var connected = false

    function find(win, depth) {
      while (win && depth > 0) {
        if (win.API) return win.API
        win = win.parent === win ? null : win.parent
        depth -= 1
      }
      return null
    }

    function init() {
      api = find(window, 10) || (window.opener ? find(window.opener, 10) : null)
      if (!api) return
      connected = api.LMSInitialize('') === 'true'
      if (connected) {
        var status = api.LMSGetValue('cmi.core.lesson_status')
        if (!status || status === 'not attempted') api.LMSSetValue('cmi.core.lesson_status', 'incomplete')
        api.LMSCommit('')
      }
    }

    function report(p) {
      if (!connected || !api) return
      if (p.score !== null) {
        api.LMSSetValue('cmi.core.score.raw', String(Math.round(p.score * 100)))
        api.LMSSetValue('cmi.core.score.min', '0')
        api.LMSSetValue('cmi.core.score.max', '100')
      }
      var finished = p.lessonsTotal > 0 && p.lessonsDone === p.lessonsTotal
      if (finished) {
        var passed = p.score === null || p.score >= PASS_MARK
        api.LMSSetValue('cmi.core.lesson_status', passed ? 'passed' : 'failed')
      }
      api.LMSCommit('')
    }

    function finish() {
      if (connected && api) api.LMSFinish('')
    }

    return { init: init, report: report, finish: finish }
  })()

  // -------------------------------------------------------------- narration

  var speech = (function () {
    var supported = 'speechSynthesis' in window
    var speaking = false
    var onEnd = null

    function speak(text, done) {
      stop()
      if (!supported || !text) { if (done) done(); return }
      var utterance = new window.SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.pitch = 1
      onEnd = done
      utterance.onend = function () {
        speaking = false
        var callback = onEnd
        onEnd = null
        if (callback) callback()
      }
      utterance.onerror = function () { speaking = false; onEnd = null }
      speaking = true
      window.speechSynthesis.speak(utterance)
    }

    function stop() {
      onEnd = null
      if (!supported) return
      speaking = false
      window.speechSynthesis.cancel()
    }

    return {
      supported: supported,
      speak: speak,
      stop: stop,
      isSpeaking: function () { return speaking },
    }
  })()

  // ------------------------------------------------------------------- view

  var view = { type: 'lesson', moduleIndex: 0, lessonIndex: 0, sceneIndex: 0 }
  var playing = false

  var sidebar = document.getElementById('sidebar')
  var main = document.getElementById('main')

  function go(next) {
    speech.stop()
    playing = false
    view = next
    if (view.type === 'lesson') {
      var lesson = currentLesson()
      if (lesson && !state.visited[lesson.id]) {
        state.visited[lesson.id] = true
        save()
      }
    }
    render()
    window.scrollTo(0, 0)
  }

  function currentModule() { return COURSE.modules[view.moduleIndex] }
  function currentLesson() {
    var module = currentModule()
    return module ? module.lessons[view.lessonIndex] : null
  }

  /* The linear running order a learner walks: every lesson, then that module's quiz. */
  function timeline() {
    var stops = []
    COURSE.modules.forEach(function (module, moduleIndex) {
      module.lessons.forEach(function (lesson, lessonIndex) {
        stops.push({ type: 'lesson', moduleIndex: moduleIndex, lessonIndex: lessonIndex, sceneIndex: 0 })
      })
      if (module.quiz && module.quiz.questions.length) {
        stops.push({ type: 'quiz', moduleIndex: moduleIndex, lessonIndex: 0, sceneIndex: 0 })
      }
    })
    if (COURSE.finalAssessment && COURSE.finalAssessment.questions.length) {
      stops.push({ type: 'final', moduleIndex: 0, lessonIndex: 0, sceneIndex: 0 })
    }
    return stops
  }

  function positionInTimeline() {
    var stops = timeline()
    for (var i = 0; i < stops.length; i += 1) {
      var stop = stops[i]
      if (stop.type !== view.type) continue
      if (view.type === 'final') return i
      if (stop.moduleIndex !== view.moduleIndex) continue
      if (view.type === 'quiz') return i
      if (stop.lessonIndex === view.lessonIndex) return i
    }
    return 0
  }

  function step(delta) {
    var stops = timeline()
    var next = positionInTimeline() + delta
    if (next < 0 || next >= stops.length) return
    go(stops[next])
  }

  // ----------------------------------------------------------------- render

  function el(tag, attrs, children) {
    var node = document.createElement(tag)
    if (attrs) {
      for (var key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue
        if (key === 'class') node.className = attrs[key]
        else if (key === 'text') node.textContent = attrs[key]
        else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2), attrs[key])
        else node.setAttribute(key, attrs[key])
      }
    }
    ;(children || []).forEach(function (child) {
      if (child) node.appendChild(child)
    })
    return node
  }

  function render() {
    renderSidebar()
    if (view.type === 'lesson') renderLesson()
    else if (view.type === 'quiz') renderQuiz(currentModule().quiz.questions, 'quiz:' + currentModule().id, currentModule().title)
    else renderQuiz(COURSE.finalAssessment.questions, 'final', 'Final assessment')
  }

  function renderSidebar() {
    var p = progress()
    sidebar.textContent = ''
    sidebar.appendChild(el('div', { class: 'brand', text: 'Course' }))
    sidebar.appendChild(el('div', { class: 'course-title', text: COURSE.title }))
    if (COURSE.subtitle) sidebar.appendChild(el('p', { class: 'course-sub', text: COURSE.subtitle }))

    var fill = el('i')
    fill.style.width = Math.round(p.ratio * 100) + '%'
    sidebar.appendChild(el('div', { class: 'bar' }, [fill]))
    sidebar.appendChild(
      el('div', {
        class: 'bar-label',
        text: p.lessonsDone + ' of ' + p.lessonsTotal + ' lessons' +
          (p.score !== null ? ' · ' + Math.round(p.score * 100) + '% on checks' : ''),
      }),
    )

    COURSE.modules.forEach(function (module, moduleIndex) {
      var block = el('div', { class: 'mod' }, [
        el('div', { class: 'mod-title', text: 'Module ' + (moduleIndex + 1) + ' · ' + module.title }),
      ])
      module.lessons.forEach(function (lesson, lessonIndex) {
        var active = view.type === 'lesson' && view.moduleIndex === moduleIndex && view.lessonIndex === lessonIndex
        block.appendChild(
          el('button', {
            class: 'nav-item',
            'aria-current': active ? 'true' : 'false',
            onclick: function () {
              go({ type: 'lesson', moduleIndex: moduleIndex, lessonIndex: lessonIndex, sceneIndex: 0 })
            },
          }, [
            el('span', { class: 'tick', text: state.visited[lesson.id] ? '✓' : '' }),
            el('span', { text: lesson.title }),
          ]),
        )
      })
      if (module.quiz && module.quiz.questions.length) {
        var quizActive = view.type === 'quiz' && view.moduleIndex === moduleIndex
        var result = state.quizzes['quiz:' + module.id]
        block.appendChild(
          el('button', {
            class: 'nav-item quiz',
            'aria-current': quizActive ? 'true' : 'false',
            onclick: function () {
              go({ type: 'quiz', moduleIndex: moduleIndex, lessonIndex: 0, sceneIndex: 0 })
            },
          }, [
            el('span', { class: 'tick', text: result ? '✓' : '' }),
            el('span', { text: 'Knowledge check' }),
          ]),
        )
      }
      sidebar.appendChild(block)
    })

    if (COURSE.finalAssessment && COURSE.finalAssessment.questions.length) {
      sidebar.appendChild(
        el('button', {
          class: 'nav-item quiz',
          'aria-current': view.type === 'final' ? 'true' : 'false',
          onclick: function () { go({ type: 'final', moduleIndex: 0, lessonIndex: 0, sceneIndex: 0 }) },
        }, [
          el('span', { class: 'tick', text: state.quizzes.final ? '✓' : '' }),
          el('span', { text: 'Final assessment' }),
        ]),
      )
    }
  }

  function renderLesson() {
    var module = currentModule()
    var lesson = currentLesson()
    main.textContent = ''
    if (!lesson) return

    var scenes = lesson.scenes.length
      ? lesson.scenes
      : [{ heading: lesson.title, bullets: [], narration: lesson.summary || '', visual: '' }]
    if (view.sceneIndex >= scenes.length) view.sceneIndex = scenes.length - 1
    var scene = scenes[view.sceneIndex]

    var bullets = el('ul', {}, scene.bullets.map(function (bullet) {
      return el('li', { text: bullet })
    }))

    var dots = el('div', { class: 'scene-dots' }, scenes.map(function (_, index) {
      return el('i', { class: index < view.sceneIndex ? 'done' : index === view.sceneIndex ? 'now' : '' })
    }))

    main.appendChild(
      el('div', { class: 'stage' }, [
        el('div', {
          class: 'eyebrow',
          text: 'Module ' + (view.moduleIndex + 1) + ' · ' + lesson.title +
            ' · Scene ' + (view.sceneIndex + 1) + ' of ' + scenes.length,
        }),
        el('h2', { text: scene.heading }),
        scene.bullets.length ? bullets : null,
        dots,
      ]),
    )

    var playLabel = playing ? 'Pause narration' : speech.supported ? 'Play lesson' : 'Narration unavailable'
    var controls = el('div', { class: 'controls' }, [
      el('button', {
        class: 'btn primary',
        text: playLabel,
        disabled: speech.supported ? null : 'disabled',
        onclick: togglePlay,
      }),
      el('button', {
        class: 'btn',
        text: '← Previous',
        disabled: view.sceneIndex === 0 && positionInTimeline() === 0 ? 'disabled' : null,
        onclick: function () {
          speech.stop(); playing = false
          if (view.sceneIndex > 0) { view.sceneIndex -= 1; render() } else step(-1)
        },
      }),
      el('button', {
        class: 'btn',
        text: 'Next →',
        onclick: function () {
          speech.stop(); playing = false
          if (view.sceneIndex < scenes.length - 1) { view.sceneIndex += 1; render() } else step(1)
        },
      }),
      el('div', { class: 'spacer' }),
      el('div', { class: 'timing', text: (scene.seconds || 0) + 's · ' + lesson.minutes + ' min lesson' }),
    ])
    main.appendChild(controls)

    if (scene.narration) {
      main.appendChild(
        el('details', { class: 'notes' }, [
          el('summary', { text: 'Narration script' }),
          el('p', { text: scene.narration }),
        ]),
      )
    }
    if (scene.visual) {
      main.appendChild(el('div', { class: 'visual', text: 'Visual: ' + scene.visual }))
    }

    var last = view.sceneIndex === scenes.length - 1
    if (last && lesson.takeaways.length) {
      main.appendChild(
        el('div', { class: 'card' }, [
          el('h3', { text: 'Takeaways' }),
          el('ul', { class: 'takeaways' }, lesson.takeaways.map(function (item) {
            return el('li', { text: item })
          })),
        ]),
      )
    }
    if (last && lesson.glossary.length) {
      var dl = el('dl', { class: 'glossary' })
      lesson.glossary.forEach(function (entry) {
        dl.appendChild(el('dt', { text: entry.term }))
        dl.appendChild(el('dd', { text: entry.definition }))
      })
      main.appendChild(el('div', { class: 'card' }, [el('h3', { text: 'Glossary' }), dl]))
    }

    void module
  }

  function togglePlay() {
    if (playing) {
      speech.stop()
      playing = false
      render()
      return
    }
    playing = true
    render()
    playScene()
  }

  /* Speaks the current scene, then advances — so a lesson plays start to finish unattended. */
  function playScene() {
    var lesson = currentLesson()
    if (!lesson || !playing) return
    var scenes = lesson.scenes
    var scene = scenes[view.sceneIndex]
    if (!scene) { playing = false; render(); return }
    speech.speak(scene.narration, function () {
      if (!playing) return
      if (view.sceneIndex < scenes.length - 1) {
        view.sceneIndex += 1
        render()
        playScene()
      } else {
        playing = false
        render()
      }
    })
  }

  function renderQuiz(questions, key, title) {
    main.textContent = ''
    var answers = {}
    var card = el('div', { class: 'card' }, [
      el('h3', { text: title }),
      el('p', { class: 'timing', text: questions.length + ' questions · ' + Math.round(PASS_MARK * 100) + '% to pass' }),
    ])

    var scoreLine = el('div', { class: 'score' })

    questions.forEach(function (question, questionIndex) {
      var block = el('div', { class: 'q' }, [
        el('div', { class: 'q-stem', text: questionIndex + 1 + '. ' + question.stem }),
      ])
      var buttons = []
      var why = el('div', { class: 'why' })
      why.hidden = true

      question.options.forEach(function (option, optionIndex) {
        var button = el('button', {
          class: 'opt',
          text: option,
          onclick: function () {
            if (answers[questionIndex] !== undefined) return
            answers[questionIndex] = optionIndex
            buttons.forEach(function (other, index) {
              other.disabled = true
              if (index === question.answerIndex) other.className = 'opt correct'
              else if (index === optionIndex) other.className = 'opt wrong'
            })
            why.textContent = question.explanation
            why.hidden = false
            tally()
          },
        })
        buttons.push(button)
        block.appendChild(button)
      })

      block.appendChild(why)
      card.appendChild(block)
    })

    function tally() {
      var answered = 0
      var correct = 0
      questions.forEach(function (question, index) {
        if (answers[index] === undefined) return
        answered += 1
        if (answers[index] === question.answerIndex) correct += 1
      })
      if (answered < questions.length) {
        scoreLine.className = 'score'
        scoreLine.textContent = answered + ' of ' + questions.length + ' answered'
        return
      }
      var ratio = correct / questions.length
      var passed = ratio >= PASS_MARK
      scoreLine.className = 'score ' + (passed ? 'pass' : 'fail')
      scoreLine.textContent = correct + ' of ' + questions.length + ' correct — ' +
        (passed ? 'passed' : 'not passed yet, review the module and try again')
      state.quizzes[key] = { correct: correct, total: questions.length, at: new Date().toISOString() }
      save()
      renderSidebar()
    }

    card.appendChild(scoreLine)
    card.appendChild(
      el('div', { class: 'controls' }, [
        el('button', { class: 'btn', text: '← Back', onclick: function () { step(-1) } }),
        el('button', { class: 'btn primary', text: 'Continue →', onclick: function () { step(1) } }),
        el('button', { class: 'btn', text: 'Retry', onclick: function () { render() } }),
      ]),
    )
    main.appendChild(card)
    tally()
  }

  // ------------------------------------------------------------------- boot

  scorm.init()
  window.addEventListener('beforeunload', function () {
    speech.stop()
    scorm.finish()
  })
  document.addEventListener('keydown', function (event) {
    if (event.target && /^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return
    if (event.key === 'ArrowRight') step(1)
    if (event.key === 'ArrowLeft') step(-1)
  })

  go({ type: 'lesson', moduleIndex: 0, lessonIndex: 0, sceneIndex: 0 })
})()
