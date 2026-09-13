import { GROUP_ORDER, REGIONS } from '../data/lifeExpectancy.js'
import { LIFE_FACTORS, MODES, SEXES } from '../lib/lifespan.js'
import { formatSigned } from '../lib/format.js'

const CUSTOM_REGION = 'custom'

function RegionOptions() {
  return GROUP_ORDER.map((group) => (
    <optgroup key={group} label={group}>
      {REGIONS.filter((region) => region.group === group).map((region) => (
        <option key={region.id} value={region.id}>
          {region.name}
        </option>
      ))}
    </optgroup>
  ))
}

export default function SetupPanel({
  settings,
  onChange,
  showFactors,
  onToggleFactors,
  factorYears,
  error,
  today,
  onReset,
}) {
  const set = (patch) => onChange({ ...settings, ...patch })
  const mode = MODES.find((entry) => entry.id === settings.mode) ?? MODES[0]

  return (
    <section className="panel">
      <h2 className="panel-title">Your details</h2>
      <p className="panel-note">
        Nothing leaves your device. Everything here is kept in this browser and nowhere else.
      </p>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="birth">Date of birth</label>
          <input
            id="birth"
            type="date"
            max={today}
            min="1900-01-01"
            value={settings.birthDate}
            onChange={(event) => set({ birthDate: event.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="region">Where you live</label>
          <select
            id="region"
            value={settings.regionId}
            onChange={(event) => set({ regionId: event.target.value })}
          >
            <option value="">Choose a place</option>
            <RegionOptions />
            <optgroup label="Other">
              <option value={CUSTOM_REGION}>Set the number myself</option>
            </optgroup>
          </select>
        </div>

        {settings.regionId === CUSTOM_REGION ? (
          <div className="field">
            <label htmlFor="custom">Life expectancy there</label>
            <input
              id="custom"
              type="number"
              min="20"
              max="110"
              step="0.1"
              value={settings.customExpectancy}
              onChange={(event) => set({ customExpectancy: event.target.value })}
            />
            <span className="hint">Years, at birth.</span>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="sex">Sex</label>
          <select
            id="sex"
            value={settings.sex}
            onChange={(event) => set({ sex: event.target.value })}
          >
            {SEXES.map((sex) => (
              <option key={sex.id} value={sex.id}>
                {sex.label}
              </option>
            ))}
          </select>
          <span className="hint">Life tables are published separately for men and women.</span>
        </div>

        <div className="field">
          <label htmlFor="hemisphere">Seasons</label>
          <select
            id="hemisphere"
            value={settings.hemisphere}
            onChange={(event) => set({ hemisphere: event.target.value })}
          >
            <option value="auto">Match the place above</option>
            <option value="n">Northern hemisphere</option>
            <option value="s">Southern hemisphere</option>
          </select>
        </div>
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="mode-simple">How to work it out</label>
        <div className="segmented" role="group" aria-label="How to work it out">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              id={`mode-${entry.id}`}
              type="button"
              aria-pressed={settings.mode === entry.id}
              onClick={() => set({ mode: entry.id })}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <p className="mode-blurb">{mode.blurb}</p>
      </div>

      <div className="factors">
        <button type="button" className="link-button" onClick={onToggleFactors}>
          {showFactors ? 'Hide the life factors' : 'Add a few life factors (optional)'}
        </button>

        {showFactors ? (
          <>
            <div className="factor-grid">
              {LIFE_FACTORS.map((factor) => (
                <div className="field" key={factor.id}>
                  <label htmlFor={`factor-${factor.id}`}>{factor.label}</label>
                  <select
                    id={`factor-${factor.id}`}
                    value={settings.factors[factor.id] ?? ''}
                    onChange={(event) =>
                      set({ factors: { ...settings.factors, [factor.id]: event.target.value } })
                    }
                  >
                    <option value="">Not saying</option>
                    {factor.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="factor-total">
              Adjustment: {formatSigned(factorYears)} years
              {factorYears === 0 ? ' — nothing chosen yet' : ''}
            </p>
            <p className="hint">
              These are broad averages from population studies, capped so no single set of answers
              can swing the clock too far. They describe groups of people, not you.
            </p>
          </>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}

      {settings.birthDate || settings.regionId ? (
        <p style={{ margin: '16px 0 0' }}>
          <button type="button" className="link-button" onClick={onReset}>
            Clear everything from this browser
          </button>
        </p>
      ) : null}
    </section>
  )
}
