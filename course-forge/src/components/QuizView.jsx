export default function QuizView({ title, questions }) {
  if (!questions || questions.length === 0) {
    return <p className="muted small">Not generated yet.</p>
  }
  return (
    <div>
      <h3>{title}</h3>
      {questions.map((question, index) => (
        <div className="q" key={index}>
          <b>
            {index + 1}. {question.stem}
          </b>
          <ol type="a">
            {question.options.map((option, optionIndex) => (
              <li key={optionIndex} className={optionIndex === question.answerIndex ? 'right' : ''}>
                {option}
                {optionIndex === question.answerIndex ? ' ✓' : ''}
              </li>
            ))}
          </ol>
          <p className="muted small">{question.explanation}</p>
        </div>
      ))}
    </div>
  )
}
