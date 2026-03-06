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
  const defaultStart = new Date(now)
  defaultStart.setMonth(defaultStart.getMonth() - defaultMonths)

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
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
              activePreset === p.key
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-2">
        <label className="text-sm text-gray-600">De:</label>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Ate:</label>
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={handleApply}
        className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
      >
        Filtrar
      </button>
    </div>
  )
}
