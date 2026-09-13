export const APP_NAME = 'PRINTEDPLANCOMPANY DASHBOARD'

export const PRODUCT_STATUSES = ['live', 'ready', 'production', 'idea']
export const PIN_STATUSES = ['scheduled', 'live', 'in_design', 'needs_caption']
export const POST_STATUSES = ['ready', 'scheduled', 'posted', 'draft']
export const PILLARS = ['breakdown', 'problem', 'lesson', 'journey']

export const LOW_CTR_THRESHOLD = 15 // % — pins below this are flagged "Needs Redesign"
export const LOW_VIEWS_THRESHOLD = 50 // views — products below this are "Low Traffic"

export const STATUS_LABELS = {
  live: 'Live',
  ready: 'Ready',
  production: 'Production',
  idea: 'Idea',
  scheduled: 'Scheduled',
  in_design: 'In Design',
  needs_caption: 'Needs Caption',
  posted: 'Posted',
  draft: 'Draft',
}

export const PILLAR_LABELS = {
  breakdown: 'Breakdown',
  problem: 'Problem',
  lesson: 'Lesson',
  journey: 'Journey',
}

// Tailwind classes per status. Colour rules from the brief:
// green = ready/done/live product, blue = scheduled/live pin, red = urgent/in design/draft, yellow = warning/in progress.
export const STATUS_STYLES = {
  // products
  live: 'bg-green-100 text-green-800 border-green-200',
  ready: 'bg-blue-100 text-blue-800 border-blue-200',
  production: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  idea: 'bg-slate-100 text-slate-700 border-slate-200',
  // pins
  scheduled: 'bg-green-100 text-green-800 border-green-200',
  in_design: 'bg-red-100 text-red-800 border-red-200',
  needs_caption: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  // posts
  posted: 'bg-slate-200 text-slate-700 border-slate-300',
  draft: 'bg-red-100 text-red-800 border-red-200',
}

export const PIN_STATUS_STYLES = {
  scheduled: 'bg-green-100 text-green-800 border-green-200',
  live: 'bg-blue-100 text-blue-800 border-blue-200',
  in_design: 'bg-red-100 text-red-800 border-red-200',
  needs_caption: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

export const POST_STATUS_STYLES = {
  ready: 'bg-green-100 text-green-800 border-green-200',
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  posted: 'bg-slate-200 text-slate-700 border-slate-300',
  draft: 'bg-red-100 text-red-800 border-red-200',
}

export const PIPELINE_STEPS = [
  { key: 'idea_complete', label: 'Idea', short: 'Idea' },
  { key: 'template_built', label: 'Template Built', short: 'Template' },
  { key: 'images_done', label: 'Images Done', short: 'Images' },
  { key: 'etsy_copy_written', label: 'Etsy Copy', short: 'Etsy Copy' },
  { key: 'pinterest_copy_written', label: 'Pinterest Copy', short: 'Pin Copy' },
  { key: 'instagram_post_written', label: 'Instagram Post', short: 'IG Post' },
]

export const TIMEZONES = [
  { value: 'Europe/London', label: 'UK (Europe/London)' },
  { value: 'UTC', label: 'UTC' },
]

export const SETTINGS_KEY = 'ppc_settings'
export const DEFAULT_SETTINGS = {
  timezone: 'Europe/London',
  defaultProductStatus: 'idea',
  apiKeys: { etsy: '', pinterest: '', instagram: '' },
}
