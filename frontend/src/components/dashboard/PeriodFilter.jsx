import { useState } from 'react'
import { toISODate } from '../../lib/formatters'

const PRESETS = [
  { label: 'Mes Atual', key: 'current' },
  { label: '1 Mes', key: '1m' },
  { label: '3 Meses', key: '3m' },
  { label: '6 Meses', key: '6m' },
]

export default function PeriodFilter({ onFilter, defaultMonths = 1 }) {
  const now = new Date()
  const defaultStart = defaultMonths === 0
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() - defaultMonths, now.getDate())

  const [startDate, setStartDate] = useState(toISODate(defaultStart))
  const [endDate, setEndDate] = useState(toISODate(now))
  const [activePreset, setActivePreset] = useState(null)

  const handleApply = () => {
    setActivePreset(null)
    onFilter(startDate, endDate)
  }

  const setPreset = (key) => {
    const end = new Date()
    let start
    if (key === 'current') {
      start = new Date(end.getFullYear(), end.getMonth(), 1)
    } else {
      const months = parseInt(key)
      start = new Date(end)
      start.setMonth(start.getMonth() - months)
    }
    setStartDate(toISODate(start))
    setEndDate(toISODate(end))
    setActivePreset(key)
    onFilter(toISODate(start), toISODate(end))
  }

  return (
    <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
      <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded font-medium transition-colors whitespace-nowrap ${
              activePreset === p.key
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs sm:text-sm text-gray-600">De:</label>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="flex-1 sm:flex-none px-2 py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="text-xs sm:text-sm text-gray-600">Ate:</label>
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="flex-1 sm:flex-none px-2 py-1.5 border border-gray-300 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleApply}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          Filtrar
        </button>
      </div>
    </div>
  )
}
