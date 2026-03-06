import axios from 'axios'

const api = axios.create({
  baseURL: '/api/dashboard',
  timeout: 10 * 60 * 1000, // 10 minutes - Sankhya API pagination is slow
})

export default api
