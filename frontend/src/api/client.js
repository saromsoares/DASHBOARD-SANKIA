import axios from 'axios'

const api = axios.create({
  baseURL: '/api/dashboard',
  timeout: 10 * 60 * 1000, // 10 minutes - Sankhya API pagination is slow
})

export default api

/**
 * Invalidate backend cache keys (forces fresh data on next fetch).
 * @param {string[]} keys - Cache key prefixes to invalidate
 */
export async function invalidateBackendCache(keys) {
  try {
    await api.post('/invalidate-cache', { keys })
  } catch (err) {
    console.warn('Cache invalidation failed:', err.message)
  }
}
