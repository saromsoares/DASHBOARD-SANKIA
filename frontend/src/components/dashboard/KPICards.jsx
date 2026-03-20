import { formatBRL, formatNumber } from '../../lib/formatters'

const META = 3000000
const SUPER_META = 4000000

export default function KPICards({ periodSales, vendorCount }) {
  const salesValue = periodSales?.totalValue || 0
  const pctMeta = Math.min((salesValue / META) * 100, 100)
  const pctSuper = Math.min((salesValue / SUPER_META) * 100, 100)
  const metaAtingida = salesValue >= META
  const superMetaAtingida = salesValue >= SUPER_META

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
      {/* Vendas do Mes */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-5 border-l-4 border-green-500">
        <p className="text-xs sm:text-sm text-gray-500 font-medium">Vendas no Mes</p>
        <p className="text-lg sm:text-2xl font-bold mt-1 text-gray-900">{formatBRL(salesValue)}</p>
        <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{periodSales?.totalInvoices || 0} notas emitidas</p>
      </div>

      {/* Meta do Mes */}
      <div className={`bg-white rounded-lg shadow p-3 sm:p-5 border-l-4 ${metaAtingida ? 'border-green-500' : 'border-yellow-500'}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-gray-500 font-medium">Meta do Mes</p>
          {metaAtingida && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">ATINGIDA</span>}
        </div>
        <p className="text-lg sm:text-2xl font-bold mt-1 text-gray-900">{formatBRL(META)}</p>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">{pctMeta.toFixed(1)}%</span>
            <span className="text-gray-400">Faltam {formatBRL(Math.max(META - salesValue, 0))}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${metaAtingida ? 'bg-green-500' : pctMeta >= 70 ? 'bg-yellow-400' : 'bg-orange-400'}`}
              style={{ width: `${pctMeta}%` }}
            />
          </div>
        </div>
      </div>

      {/* Super Meta */}
      <div className={`bg-white rounded-lg shadow p-3 sm:p-5 border-l-4 ${superMetaAtingida ? 'border-purple-500' : 'border-gray-300'}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-gray-500 font-medium">Super Meta</p>
          {superMetaAtingida && <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">ATINGIDA</span>}
        </div>
        <p className="text-lg sm:text-2xl font-bold mt-1 text-gray-900">{formatBRL(SUPER_META)}</p>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">{pctSuper.toFixed(1)}%</span>
            <span className="text-gray-400">Faltam {formatBRL(Math.max(SUPER_META - salesValue, 0))}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${superMetaAtingida ? 'bg-purple-500' : pctSuper >= 50 ? 'bg-blue-400' : 'bg-gray-300'}`}
              style={{ width: `${pctSuper}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
