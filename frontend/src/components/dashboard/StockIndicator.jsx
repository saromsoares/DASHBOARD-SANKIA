const COLOR_MAP = {
  red: 'bg-red-100 text-red-800 border-red-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
}

const DOT_MAP = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  gray: 'bg-gray-400',
  purple: 'bg-purple-500',
}

export default function StockIndicator({ status }) {
  const cls = COLOR_MAP[status.color] || COLOR_MAP.gray
  const dot = DOT_MAP[status.color] || DOT_MAP.gray

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {status.label}
    </span>
  )
}
