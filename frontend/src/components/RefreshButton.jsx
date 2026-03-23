import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { invalidateBackendCache } from '../api/client'

// Map frontend query keys to backend cache key prefixes
const BACKEND_CACHE_MAP = {
  'sales-data': 'sales_data',
  'top-products-asx': 'top_products_asx',
  'pending-billing': 'pending_billing',
  'purchase-management': 'purchase_management',
  'products': 'products_all',
  'sales-summary': 'sales_summary',
  'importacoes': null, // no backend cache
}

export default function RefreshButton({ queryKeys, label = 'Atualizar' }) {
  const queryClient = useQueryClient()
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = async () => {
    setSpinning(true)
    // Invalidate backend cache first, then frontend queries
    const backendKeys = queryKeys.map(k => BACKEND_CACHE_MAP[k]).filter(Boolean)
    if (backendKeys.length > 0) {
      await invalidateBackendCache(backendKeys)
    }
    await Promise.all(
      queryKeys.map(key => queryClient.invalidateQueries({ queryKey: [key] }))
    )
    setTimeout(() => setSpinning(false), 600)
  }

  return (
    <button
      onClick={handleRefresh}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-800 transition-colors"
      title={label}
    >
      <svg
        className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {label}
    </button>
  )
}
