export function getStockStatus(stock, avgMonth) {
  if (avgMonth === 0 && stock === 0) return { label: 'Sem Giro', color: 'gray', key: 'sem_giro' }
  const coverage = avgMonth > 0 ? stock / avgMonth : 999
  if (coverage < 1) return { label: 'Critico', color: 'red', key: 'critico' }
  if (coverage < 3) return { label: 'Atencao', color: 'yellow', key: 'atencao' }
  return { label: 'OK', color: 'green', key: 'ok' }
}

export function getCoverageMonths(stock, avgMonth) {
  if (avgMonth === 0) return stock > 0 ? null : 0
  return Math.round((stock / avgMonth) * 100) / 100
}
