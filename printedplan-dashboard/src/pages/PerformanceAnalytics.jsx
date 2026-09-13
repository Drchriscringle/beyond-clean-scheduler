import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, usePerformance, usePins, usePosts, useProducts } from '../hooks/useData.js'
import { useSettings } from '../hooks/useSettings.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { LOW_CTR_THRESHOLD, LOW_VIEWS_THRESHOLD } from '../lib/constants.js'
import { dailyAverage, pinCtr, pinNeedsRedesign, postEngagement, productRevenue, sum, trendPercent } from '../lib/calc.js'
import { addDays, diffDays, formatDate, monthKey, todayISO, weekStart } from '../lib/dates.js'
import { int, money, pct } from '../lib/format.js'
import { ConfirmDialog, ErrorBanner, FilterBar, PageHeader, Select, Spinner } from '../components/ui.jsx'
import { ChartCard, CtrLine, EngagementByPost, RevenueByProduct, RevenueLine } from '../components/Charts.jsx'
import PerformanceEntryModal from '../components/PerformanceCard.jsx'

const METRICS = [
  ['etsy_revenue', 'Etsy Revenue', money],
  ['etsy_sales', 'Etsy Sales', int],
  ['etsy_views', 'Etsy Views', int],
  ['pinterest_clicks', 'Pinterest Clicks', int],
  ['pinterest_impressions', 'Pinterest Impressions', int],
  ['instagram_likes', 'Instagram Likes', int],
  ['instagram_saves', 'Instagram Saves', int],
]

export default function PerformanceAnalytics() {
  const toast = useToast()
  const { settings } = useSettings()
  const today = todayISO(settings.timezone)
  const [preset, setPreset] = useState('7')
  const [custom, setCustom] = useState({ from: addDays(today, -13), to: today })
  const [view, setView] = useState('daily')
  const [entry, setEntry] = useState(null) // null | {} | row
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const range = useMemo(() => {
    if (preset === 'custom') return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
    const days = Number(preset)
    return { from: addDays(today, -(days - 1)), to: today }
  }, [preset, custom, today])
  const days = diffDays(range.from, range.to) + 1
  const prevRange = { from: addDays(range.from, -days), to: addDays(range.from, -1) }

  const perf = usePerformance(prevRange.from, range.to)
  const products = useProducts()
  const pins = usePins()
  const posts = usePosts()

  const current = useMemo(() => (perf.data || []).filter((r) => r.date >= range.from && r.date <= range.to), [perf.data, range])
  const previous = useMemo(() => (perf.data || []).filter((r) => r.date >= prevRange.from && r.date <= prevRange.to), [perf.data, prevRange.from, prevRange.to])

  const buckets = useMemo(() => {
    const keyFor = view === 'weekly' ? weekStart : view === 'monthly' ? monthKey : (d) => d
    const map = new Map()
    for (const r of current) {
      const k = keyFor(r.date)
      const b = map.get(k) || { key: k, etsy_revenue: 0, pinterest_clicks: 0, pinterest_impressions: 0 }
      b.etsy_revenue += Number(r.etsy_revenue) || 0
      b.pinterest_clicks += Number(r.pinterest_clicks) || 0
      b.pinterest_impressions += Number(r.pinterest_impressions) || 0
      map.set(k, b)
    }
    return [...map.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => ({
        ...b,
        label: view === 'monthly' ? b.key : formatDate(b.key),
        ctr: b.pinterest_impressions > 0 ? Math.round((b.pinterest_clicks / b.pinterest_impressions) * 10000) / 100 : null,
      }))
  }, [current, view])

  const topProducts = useMemo(
    () =>
      (products.data || [])
        .map((p) => ({ name: p.name, revenue: productRevenue(p), id: p.id }))
        .filter((p) => p.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    [products.data],
  )
  const postBars = useMemo(
    () =>
      (posts.data || [])
        .filter((p) => p.status === 'posted')
        .sort((a, b) => postEngagement(b) - postEngagement(a))
        .slice(0, 12)
        .map((p) => ({ label: `#${p.post_number}`, likes: p.likes, saves: p.saves, comments: p.comments, id: p.id })),
    [posts.data],
  )

  const bestProduct = topProducts[0]
  const livePins = (pins.data || []).filter((p) => p.status === 'live' && pinCtr(p) !== null)
  const bestPin = [...livePins].sort((a, b) => pinCtr(b) - pinCtr(a))[0]
  const bestPost = [...(posts.data || [])].filter((p) => p.status === 'posted').sort((a, b) => postEngagement(b) - postEngagement(a))[0]
  const weakPins = livePins.filter((p) => pinNeedsRedesign(p, LOW_CTR_THRESHOLD))
  const lowTraffic = (products.data || []).filter((p) => p.status === 'live' && (Number(p.etsy_views_30d) || 0) < LOW_VIEWS_THRESHOLD)

  async function removeEntry() {
    setBusy(true)
    try {
      await api.deletePerformance(deleting.id)
      perf.setData((list) => list.filter((r) => r.id !== deleting.id))
      toast.success(`Deleted ${deleting.date}.`)
      setDeleting(null)
    } catch (e) {
      toast.error(`Failed to delete: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const loading = perf.loading && !perf.data

  return (
    <div>
      <PageHeader
        title="Performance Analytics"
        subtitle={`${formatDate(range.from, { year: true })} → ${formatDate(range.to, { year: true })} (${days} days) vs the ${days} days before.`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              Export as PDF
            </button>
            <button type="button" className="btn-primary" onClick={() => setEntry({})}>
              + Log today&apos;s numbers
            </button>
          </>
        }
      />
      <ErrorBanner error={perf.error} onRetry={perf.reload} />

      <FilterBar>
        <Select className="w-auto!" value={preset} onChange={setPreset} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: 'custom', label: 'Custom range' }]} aria-label="Date range" />
        {preset === 'custom' && (
          <>
            <input className="input w-auto!" type="date" value={custom.from} max={today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="From" />
            <span className="text-slate-400">→</span>
            <input className="input w-auto!" type="date" value={custom.to} max={today} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="To" />
          </>
        )}
        <Select className="w-auto!" value={view} onChange={setView} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} aria-label="View type" />
      </FilterBar>

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">Metric</th>
                  <th className="table-th text-right">Total</th>
                  <th className="table-th text-right">Daily avg</th>
                  <th className="table-th text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {METRICS.map(([key, label, fmt]) => {
                  const total = sum(current, key)
                  const prev = sum(previous, key)
                  const trend = trendPercent(total, prev)
                  return (
                    <tr key={key}>
                      <td className="table-td font-medium">{label}</td>
                      <td className="table-td text-right font-semibold">{fmt(total)}</td>
                      <td className="table-td text-right">{fmt(dailyAverage(total, days))}</td>
                      <td className="table-td text-right">
                        <Trend value={trend} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {current.length === 0 && (
              <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                No daily numbers logged in this range yet. Click “+ Log today&apos;s numbers” to start.
              </p>
            )}
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Etsy revenue">
              <RevenueLine data={buckets} />
            </ChartCard>
            <ChartCard title="Pinterest CTR %">
              <CtrLine data={buckets} />
            </ChartCard>
            <ChartCard title="Revenue by product (30d, top 10)" height={220}>
              {topProducts.length ? <RevenueByProduct products={topProducts} onSelect={() => {}} /> : <Empty />}
            </ChartCard>
            <ChartCard title="Engagement by Instagram post">{postBars.length ? <EngagementByPost posts={postBars} /> : <Empty />}</ChartCard>
          </div>

          {/* Top performers + needs attention */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Top performers</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  🏆 Product by revenue:{' '}
                  {bestProduct ? (
                    <Link to="/etsy" className="font-semibold hover:underline">
                      {bestProduct.name} ({money(bestProduct.revenue)})
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </li>
                <li>
                  📌 Pinterest pin:{' '}
                  {bestPin ? (
                    <Link to="/pinterest" className="font-semibold hover:underline">
                      {bestPin.pin_name} ({pct(pinCtr(bestPin))} CTR)
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </li>
                <li>
                  📱 Instagram post:{' '}
                  {bestPost ? (
                    <Link to="/instagram" className="font-semibold hover:underline">
                      Post #{bestPost.post_number} ({postEngagement(bestPost)} engagement)
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </li>
              </ul>
            </div>
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Needs attention</h3>
              <p className="text-sm font-semibold text-red-700">⚠ Underperforming pins (CTR &lt; {LOW_CTR_THRESHOLD}%)</p>
              {weakPins.length ? (
                <ul className="mb-3 mt-1 list-disc pl-5 text-sm text-slate-700">
                  {weakPins.map((p) => (
                    <li key={p.id}>
                      <Link to="/pinterest" className="hover:underline">
                        {p.pin_name}
                      </Link>{' '}
                      — {pct(pinCtr(p))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 mt-1 text-sm text-slate-400">None.</p>
              )}
              <p className="text-sm font-semibold text-red-700">⚠ Low-traffic live products (&lt; {LOW_VIEWS_THRESHOLD} views)</p>
              {lowTraffic.length ? (
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                  {lowTraffic.map((p) => (
                    <li key={p.id}>
                      <Link to="/etsy" className="hover:underline">
                        {p.name}
                      </Link>{' '}
                      — {int(p.etsy_views_30d)} views
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-400">None.</p>
              )}
            </div>
          </div>

          {/* Daily log */}
          <div className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-800">Daily log ({current.length} days in range)</h3>
              <button type="button" className="btn-secondary btn-sm no-print" onClick={() => setEntry({})}>
                + Add day
              </button>
            </div>
            {current.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Nothing logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-th">Date</th>
                      <th className="table-th text-right">Revenue</th>
                      <th className="table-th text-right">Sales</th>
                      <th className="table-th text-right">Views</th>
                      <th className="table-th text-right">Pin clicks</th>
                      <th className="table-th text-right">Pin impr.</th>
                      <th className="table-th text-right">IG likes</th>
                      <th className="table-th text-right">IG saves</th>
                      <th className="table-th text-right">IG clicks</th>
                      <th className="table-th no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...current].reverse().map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="table-td font-medium">{formatDate(r.date, { year: true })}</td>
                        <td className="table-td text-right">{money(r.etsy_revenue)}</td>
                        <td className="table-td text-right">{int(r.etsy_sales)}</td>
                        <td className="table-td text-right">{int(r.etsy_views)}</td>
                        <td className="table-td text-right">{int(r.pinterest_clicks)}</td>
                        <td className="table-td text-right">{int(r.pinterest_impressions)}</td>
                        <td className="table-td text-right">{int(r.instagram_likes)}</td>
                        <td className="table-td text-right">{int(r.instagram_saves)}</td>
                        <td className="table-td text-right">{int(r.instagram_clicks)}</td>
                        <td className="table-td no-print">
                          <div className="flex gap-1">
                            <button type="button" className="btn-secondary btn-sm" onClick={() => setEntry(r)}>
                              Edit
                            </button>
                            <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setDeleting(r)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <PerformanceEntryModal
        open={entry !== null}
        entry={entry?.id ? entry : null}
        defaultDate={today}
        onClose={() => setEntry(null)}
        onSaved={(saved) =>
          perf.setData((list) => {
            const next = list.some((r) => r.date === saved.date) ? list.map((r) => (r.date === saved.date ? saved : r)) : [...list, saved]
            return next.sort((a, b) => a.date.localeCompare(b.date))
          })
        }
      />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={removeEntry} busy={busy} title="Delete this day?" message={`Remove the numbers logged for ${deleting?.date}?`} />
    </div>
  )
}

function Trend({ value }) {
  if (value === null) return <span className="text-slate-400">new</span>
  if (value === 0) return <span className="text-slate-500">→ 0%</span>
  const up = value > 0
  return <span className={`font-semibold ${up ? 'text-green-700' : 'text-red-700'}`}>{up ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%</span>
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-slate-400">No data yet.</div>
}
