import { useQuery } from '@tanstack/react-query'
import api from './client'

export function useProducts(page = 0, pageSize = 50) {
  return useQuery({
    queryKey: ['products', page, pageSize],
    queryFn: () => api.get(`/products?page=${page}&pageSize=${pageSize}`).then(r => r.data),
    refetchInterval: 120 * 1000,
  })
}

export function useStock(codprods) {
  return useQuery({
    queryKey: ['stock', codprods?.join(',')],
    queryFn: () => api.get(`/stock?codprods=${codprods.join(',')}`).then(r => r.data),
    enabled: !!codprods && codprods.length > 0,
    refetchInterval: 120 * 1000,
  })
}

export function useSalesSummary(months = 6) {
  return useQuery({
    queryKey: ['sales-summary', months],
    queryFn: () => api.get(`/sales-summary?months=${months}`).then(r => r.data),
    refetchInterval: 60 * 1000,
  })
}

export function usePurchaseSuggestions() {
  return useQuery({
    queryKey: ['purchase-suggestions'],
    queryFn: () => api.get('/purchase-suggestions').then(r => r.data),
    refetchInterval: false, // disabled - too heavy, manual refresh only
    staleTime: 30 * 60 * 1000, // 30 min
  })
}

export function usePurchaseManagement() {
  return useQuery({
    queryKey: ['purchase-management'],
    queryFn: () => api.get('/purchase-management').then(r => r.data),
    // Poll every 15s while loading (warm-up running), stop when data arrives
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.loading) return 15 * 1000  // poll while warming up
      return 10 * 60 * 1000  // 10 min refresh after loaded
    },
  })
}

export function useTopProductsAsx() {
  return useQuery({
    queryKey: ['top-products-asx'],
    queryFn: () => api.get('/top-products-asx').then(r => r.data),
    refetchInterval: 5 * 60 * 1000, // 5 min - same as backend cache
  })
}

export function useSearchPartners(term) {
  return useQuery({
    queryKey: ['search-partners', term],
    queryFn: () => api.get(`/search-partners?term=${encodeURIComponent(term)}`).then(r => r.data),
    enabled: !!term && term.length >= 2,
    staleTime: 60 * 1000,
  })
}

export function useProductsByPartner(codparc) {
  return useQuery({
    queryKey: ['products-by-partner', codparc],
    queryFn: () => api.get(`/products-by-partner?codparc=${codparc}`).then(r => r.data),
    enabled: !!codparc,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Unified sales data hook - fetches period totals + vendor breakdown in a single API call.
 * This avoids concurrent Sankhya API calls which cause empty responses.
 */
export function useSalesData(startDate, endDate) {
  return useQuery({
    queryKey: ['sales-data', startDate, endDate],
    queryFn: () => api.get(`/sales-data?startDate=${startDate}&endDate=${endDate}`).then(r => r.data),
    enabled: !!startDate && !!endDate,
    refetchInterval: 5 * 60 * 1000, // 5 min
  })
}

export function usePendingBilling() {
  return useQuery({
    queryKey: ['pending-billing'],
    queryFn: () => api.get('/pending-billing').then(r => r.data),
    refetchInterval: 5 * 60 * 1000,
  })
}

export function useImportacoes() {
  return useQuery({
    queryKey: ['importacoes'],
    queryFn: () => api.get('/importacoes').then(r => r.data),
    refetchInterval: 60 * 1000,
  })
}

export function useSearchProductsAsx(term) {
  return useQuery({
    queryKey: ['search-products-asx', term],
    queryFn: () => api.get(`/search-products-asx?term=${encodeURIComponent(term)}`).then(r => r.data),
    enabled: !!term && term.length >= 2,
    staleTime: 60 * 1000,
  })
}
