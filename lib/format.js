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
