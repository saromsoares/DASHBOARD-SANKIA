export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0)
}

export function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  // Already dd/MM/yyyy
  if (dateStr.includes('/')) return dateStr
  // ISO yyyy-MM-dd
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
