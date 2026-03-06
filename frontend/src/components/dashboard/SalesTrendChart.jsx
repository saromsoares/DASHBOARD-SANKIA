import { formatBRL } from '../../lib/formatters'

const MEDAL = ['bg-yellow-400 text-yellow-900', 'bg-gray-300 text-gray-700', 'bg-orange-300 text-orange-800']

export default function SalesTrendChart({ topBuyers = [] }) {
  const maxValue = topBuyers.length > 0 ? topBuyers[0].totalValue : 1

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 Compradores do Mes</h3>
      {topBuyers.length === 0 ? (
        <p className="text-gray-400 text-sm">Sem dados de compras.</p>
      ) : (
        <div className="space-y-2">
          {topBuyers.map((buyer, i) => {
            const barWidth = maxValue > 0 ? (buyer.totalValue / maxValue) * 100 : 0
            return (
              <div key={buyer.codparc} className="flex items-center gap-3">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                  MEDAL[i] || 'bg-gray-100 text-gray-500'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{buyer.nome}</span>
                    <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{formatBRL(buyer.totalValue)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{buyer.vendedor}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
