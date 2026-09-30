import Shirt, { defaultShirt } from './Shirt.jsx'

// A retro front page for a match report email.
export default function Newspaper({ article, career }) {
  const a = article
  return (
    <div className="paper">
      <div className="paper-strap">
        <span>{a.extra ? '★ SPECIAL EDITION ★' : 'PRICE 50p'}</span>
        <span>{a.strap}</span>
      </div>
      <div className="paper-mast">
        <div className="paper-extra">{a.extra ? <>EXTRA!<br />EXTRA!</> : <>SPORT<br />DESK</>}</div>
        <div className="paper-title">{a.paper}</div>
        <div className="paper-edition">{a.edition.split(' ').map((w) => <span key={w}>{w}</span>)}</div>
      </div>
      <div className="paper-dateline">{new Date(`${a.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} · Darts · Est. 2027</div>
      <div className="paper-kicker">{a.kicker}</div>
      <h1 className="paper-headline">{a.headline}</h1>
      <div className="paper-sub">{a.subhead}</div>
      <div className="paper-cols">
        <div className="paper-main">
          <figure className={`paper-photo mood-${a.photo.mood}`}>
            <Shirt shirt={career.shirt ?? defaultShirt(career)} sponsors={career.sponsors} nation={career.players.user.nation} side="back" size={104} />
            <figcaption>{a.photo.caption}</figcaption>
          </figure>
          {a.body.map((p, i) => <p key={i} className={i === 0 ? 'lead' : ''}>{p}</p>)}
          <blockquote>“{a.quote.text}”<cite>— {a.quote.by}</cite></blockquote>
          <blockquote className="pundit">{a.pundit.text}<cite>— {a.pundit.by}</cite></blockquote>
        </div>
        <aside className="paper-side">
          {a.sidebar.map((b) => (
            <div key={b.title} className="paper-box">
              <div className="paper-box-title">{b.title}</div>
              {b.lines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          ))}
        </aside>
      </div>
      <div className="paper-foot">{a.paper.toUpperCase()} · ALL THE ARROWS, ALL THE ACTION</div>
    </div>
  )
}
