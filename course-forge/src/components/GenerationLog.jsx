import { useEffect, useRef } from 'react'

export default function GenerationLog({ entries }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [entries.length])

  if (entries.length === 0) return null

  return (
    <div className="log">
      {entries.map((entry, index) => (
        <div key={index} className={entry.kind ?? ''}>
          {entry.text}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
