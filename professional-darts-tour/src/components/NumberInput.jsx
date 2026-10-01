import { useEffect, useState } from 'react'

// A number box that behaves on phones: you can clear it completely (no stuck "0"),
// tapping it selects what's there so typing replaces it, and the value is only
// committed when it's a valid number in range.
export default function NumberInput({ value, onChange, min = 0, max = 999, decimals = false, ...rest }) {
  const [text, setText] = useState(String(value ?? ''))
  useEffect(() => {
    if (Number(text) !== Number(value)) setText(String(value ?? ''))
  }, [value])
  const clamp = (n) => Math.max(min, Math.min(max, n))
  return (
    <input
      {...rest}
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      pattern={decimals ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '').replace(/^0+(?=\d)/, '')
        setText(t)
        const n = Number(t)
        if (t !== '' && !Number.isNaN(n) && n >= min && n <= max) onChange(n)
      }}
      onBlur={() => {
        const n = Number(text)
        const fixed = text === '' || Number.isNaN(n) ? value : clamp(n)
        setText(String(fixed))
        if (fixed !== value) onChange(fixed)
      }}
    />
  )
}
