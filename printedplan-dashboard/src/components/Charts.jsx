import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money } from '../lib/format.js'

const AXIS = { fontSize: 11, fill: '#64748b' }
const PALETTE = ['#0f172a', '#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c']

export function ChartCard({ title, children, height = 260 }) {
  return (
    <div className="card p-4">
      <h3 className="mb-2 text-sm font-bold text-slate-800">{title}</h3>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  )
}

export function RevenueLine({ data }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={AXIS} minTickGap={24} />
        <YAxis tick={AXIS} tickFormatter={(v) => `£${v}`} width={54} />
        <Tooltip formatter={(v) => money(v)} labelStyle={{ fontWeight: 600 }} />
        <Line type="monotone" dataKey="etsy_revenue" name="Etsy revenue" stroke="#16a34a" strokeWidth={2} dot={data.length < 40} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function CtrLine({ data }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={AXIS} minTickGap={24} />
        <YAxis tick={AXIS} tickFormatter={(v) => `${v}%`} width={48} />
        <Tooltip formatter={(v) => (v === null ? '—' : `${Number(v).toFixed(2)}%`)} labelStyle={{ fontWeight: 600 }} />
        <Line type="monotone" dataKey="ctr" name="Pinterest CTR" stroke="#2563eb" strokeWidth={2} dot={data.length < 40} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Stacked bar: one bar ("Revenue"), one segment per product. */
export function RevenueByProduct({ products, onSelect }) {
  const row = { name: 'Top products' }
  for (const p of products) row[p.name] = p.revenue
  return (
    <ResponsiveContainer>
      <BarChart data={[row]} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={AXIS} tickFormatter={(v) => `£${v}`} />
        <YAxis type="category" dataKey="name" tick={AXIS} width={80} />
        <Tooltip formatter={(v) => money(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} onClick={(e) => onSelect?.(e.value)} />
        {products.map((p, i) => (
          <Bar key={p.name} dataKey={p.name} stackId="rev" fill={PALETTE[i % PALETTE.length]} onClick={() => onSelect?.(p.name)} cursor="pointer" />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function EngagementByPost({ posts, onSelect }) {
  return (
    <ResponsiveContainer>
      <BarChart data={posts} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={AXIS} />
        <YAxis tick={AXIS} width={40} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="likes" name="Likes" stackId="e" fill="#2563eb" onClick={(d) => onSelect?.(d)} cursor="pointer" />
        <Bar dataKey="saves" name="Saves" stackId="e" fill="#16a34a" onClick={(d) => onSelect?.(d)} cursor="pointer" />
        <Bar dataKey="comments" name="Comments" stackId="e" fill="#ca8a04" onClick={(d) => onSelect?.(d)} cursor="pointer" />
      </BarChart>
    </ResponsiveContainer>
  )
}
