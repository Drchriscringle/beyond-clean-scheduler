// Choices shown on the enquiry form. Edit these lists to change what customers can pick.

export const PROPERTY_TYPES = [
  { id: 'flat', label: 'Flat / apartment', icon: '🏢' },
  { id: 'house', label: 'House', icon: '🏠' },
  { id: 'holiday_let', label: 'Holiday let / Airbnb', icon: '🧳' },
  { id: 'office', label: 'Office / commercial', icon: '🏬' },
]

export const AREAS = [
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathrooms', label: 'Bathrooms' },
  { id: 'bedrooms', label: 'Bedrooms' },
  { id: 'living', label: 'Living / dining room' },
  { id: 'hall_stairs', label: 'Hall & stairs' },
  { id: 'whole', label: 'Whole property' },
]

export const EXTRAS = [
  { id: 'oven', label: 'Oven clean' },
  { id: 'fridge', label: 'Inside fridge / freezer' },
  { id: 'windows_in', label: 'Inside windows' },
  { id: 'carpets', label: 'Carpet cleaning' },
  { id: 'upholstery', label: 'Sofa / upholstery' },
  { id: 'linen', label: 'Bed linen change' },
  { id: 'ironing', label: 'Ironing' },
  { id: 'cupboards', label: 'Inside cupboards' },
]

export const CLEAN_TYPES = [
  { id: 'regular', label: 'Standard clean', desc: 'Dusting, hoovering, mopping, kitchen and bathrooms.' },
  { id: 'deep', label: 'Deep clean', desc: 'Top to bottom, including the bits a standard clean skips.' },
  { id: 'end_of_tenancy', label: 'End of tenancy', desc: 'Move in / move out, aimed at getting the deposit back.' },
  { id: 'after_builders', label: 'After builders', desc: 'Dust, paint marks and debris after renovation work.' },
  { id: 'holiday_turnover', label: 'Holiday let turnover', desc: 'Changeover between guests, linen included.' },
  { id: 'commercial', label: 'Office / commercial', desc: 'Workplaces, shops and communal areas.' },
]

export const TIME_WINDOWS = [
  { id: 'morning', label: 'Morning', hint: '8am – 12pm' },
  { id: 'afternoon', label: 'Afternoon', hint: '12pm – 5pm' },
  { id: 'evening', label: 'Evening', hint: '5pm – 8pm' },
  { id: 'any', label: 'Any time', hint: 'Flexible' },
]

export const ENQUIRY_STATUS = {
  new: { label: 'New', tone: 'bg-amber-100 text-amber-800' },
  replied: { label: 'Quote sent', tone: 'bg-sky-100 text-sky-800' },
  awaiting_deposit: { label: 'Awaiting deposit', tone: 'bg-amber-100 text-amber-800' },
  booked: { label: 'Booked', tone: 'bg-green-100 text-green-800' },
  completed: { label: 'Done', tone: 'bg-brand-100 text-brand-700' },
  declined: { label: 'Declined', tone: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelled', tone: 'bg-red-100 text-red-800' },
  closed: { label: 'Closed', tone: 'bg-slate-200 text-slate-700' },
}

// How the cleaner gets in.
export const ACCESS_METHODS = [
  { id: 'home', label: "I'll be home" },
  { id: 'key_safe', label: 'Key safe' },
  { id: 'key_held', label: 'Beyond Clean holds a key' },
  { id: 'neighbour', label: 'Neighbour / concierge' },
  { id: 'other', label: 'Other' },
]

export const SUB_STATUS = {
  pending_payment: { label: 'Awaiting payment', tone: 'bg-amber-100 text-amber-800' },
  active: { label: 'Active', tone: 'bg-green-100 text-green-800' },
  past_due: { label: 'Payment failed', tone: 'bg-red-100 text-red-800' },
  paused: { label: 'Paused', tone: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelled', tone: 'bg-slate-200 text-slate-700' },
}

export function labelFor(list, id) {
  return (list.find((x) => x.id === id) || {}).label || id
}
