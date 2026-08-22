export const RESPONSE_TYPES = {
  confident: { label: 'Confident', quote: '"We deserved that result and I expect more of the same."' },
  diplomatic: { label: 'Diplomatic', quote: '"Credit to the players — we take it one game at a time."' },
  critical: { label: 'Critical', quote: '"That performance was not good enough. Standards must improve."' },
}

// resultPoints: 3 = win, 1 = draw, 0 = loss.
const OUTCOMES = {
  confident: {
    3: { confidenceDelta: 4, moraleDelta: 4, message: 'Your confident tone after the win goes down well with press and dressing room alike.' },
    1: { confidenceDelta: 0, moraleDelta: 1, message: 'A confident line after a draw raises a few eyebrows, but the squad shrugs it off.' },
    0: { confidenceDelta: -5, moraleDelta: -3, message: 'Staying confident after that defeat rings hollow — the board is unimpressed.' },
  },
  diplomatic: {
    3: { confidenceDelta: 2, moraleDelta: 2, message: 'A measured response after the win is well received all round.' },
    1: { confidenceDelta: 1, moraleDelta: 1, message: 'Your diplomatic answer keeps everyone calm after the draw.' },
    0: { confidenceDelta: -1, moraleDelta: 0, message: 'A diplomatic take on the defeat draws no complaints, but no praise either.' },
  },
  critical: {
    3: { confidenceDelta: 1, moraleDelta: -3, message: 'Being critical after a win keeps the board onside, but the squad feels hard done by.' },
    1: { confidenceDelta: 2, moraleDelta: -2, message: 'Demanding more after a draw pleases the board, though morale takes a small knock.' },
    0: { confidenceDelta: 3, moraleDelta: -5, message: 'The board welcomes your tough stance after the loss, but it stings the dressing room.' },
  },
}

export function evaluateResponse(resultPoints, responseType) {
  const byType = OUTCOMES[responseType]
  if (!byType) return { confidenceDelta: 0, moraleDelta: 0, message: '' }
  return byType[resultPoints] ?? byType[1]
}
