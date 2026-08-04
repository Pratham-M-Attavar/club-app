export function formatCategory(key) {
  return (key || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

export function bookingStatusVariant(status) {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'default'
  if (status === 'confirmed' || status === 'in_progress') return 'warning'
  return 'danger'
}

export function ticketStatusVariant(status) {
  if (status === 'done') return 'success'
  if (status === 'in_progress' || status === 'assigned') return 'warning'
  return 'danger'
}

export function getCurrentMonthStr() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export function dueDateForMonth(month, dueDay) {
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  const day = Math.min(Math.max(Number(dueDay) || lastDay, 1), lastDay)
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

