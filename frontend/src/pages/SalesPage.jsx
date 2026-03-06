import { useState } from 'react'
import { useSalesData } from '../api/dashboard'
import { formatBRL, formatNumber, toISODate } from '../lib/formatters'
import PeriodFilter from '../components/dashboard/PeriodFilter'
import SalesByVendorChart from '../components/dashboard/SalesByVendorChart'

const MONTH_NAMES = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

function formatMonthLabel(yyyyMm) {
  const [year, month] = yyyyMm.split('-')
  return `${MONTH_NAMES[month] || month}/${year.slice(2)}`
}

function LoadingBanner() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
      <div>
        <p className="text-sm font-medium text-blue-800">Carregando dados do Sankhya...</p>
        <p className="text-xs text-blue-600">A API pagina em blocos de 50 registros. Periodos maiores podem levar alguns minutos.</p>
      </div>
    </div>
  )
}

function getBarColor(index) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
  return colors[index % colors.length]
}

export default function SalesPage() {
  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1) // mes atual

  const [startDate, setStartDate] = useState(toISODate(defaultStart))
  const [endDate, setEndDate] = useState(toISODate(now))

  const { data: salesData, isLoading, isFetching } = useSalesData(startDate, endDate)

  const loading = isLoading || isFetching

  const handleFilter = (start, end) => {
    setStartDate(start)
    setEndDate(end)
  }

  const months = salesData?.months || []
  const vendorSales = salesData?.vendorSales || []

  // Find max total for bar width calculation
  const maxValue = vendorSales.length > 0 ? vendorSales[0].totalValue : 1

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Vendas por Periodo</h2>
        {isFetching && !isLoading && (
          <span className="text-xs text-blue-500 flex items-center gap-1">
            <span className="animate-spin rounded-full h-3 w-3 border-b border-blue-500"></span>
            Atualizando...
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <PeriodFilter onFilter={handleFilter} />
      </div>

      {isLoading && <LoadingBanner />}

      {/* Period Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Total Vendido</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {isLoading ? '...' : formatBRL(salesData?.totalValue)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Notas Emitidas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {isLoading ? '...' : formatNumber(salesData?.totalInvoices)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-purple-500">
          <p className="text-sm text-gray-500">Vendedores</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {isLoading ? '...' : formatNumber(vendorSales.length)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <SalesByVendorChart data={vendorSales} />
      </div>

      {/* Vendor Ranking Table with Monthly Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Ranking de Vendedores</h3>
          {months.length > 1 && (
            <p className="text-xs text-gray-400 mt-1">Detalhamento mes a mes do periodo selecionado</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Vendedor</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total Periodo</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Notas</th>
                {months.map(m => (
                  <th key={m} className="px-3 py-3 text-right font-medium text-gray-500 text-xs">
                    {formatMonthLabel(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorSales.map((v, i) => {
                const barWidth = maxValue > 0 ? (v.totalValue / maxValue) * 100 : 0
                return (
                  <tr key={v.codvend} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-yellow-400 text-yellow-900' :
                        i === 1 ? 'bg-gray-300 text-gray-700' :
                        i === 2 ? 'bg-orange-300 text-orange-800' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-700">{v.nome}</div>
                      {/* Visual bar */}
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full w-32">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${barWidth}%`, backgroundColor: getBarColor(i) }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatBRL(v.totalValue)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{v.totalInvoices}</td>
                    {months.map(m => {
                      const monthData = v.monthly?.[m]
                      return (
                        <td key={m} className="px-3 py-2.5 text-right text-xs">
                          {monthData ? (
                            <div>
                              <span className="text-gray-700 font-medium">{formatBRL(monthData.value)}</span>
                              <span className="text-gray-400 block">{monthData.invoices}x</span>
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {vendorSales.length === 0 && (
                <tr>
                  <td colSpan={4 + months.length} className="px-4 py-8 text-center text-gray-400">
                    {loading ? 'Carregando dados... isso pode levar alguns minutos.' : 'Sem dados para o periodo.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
