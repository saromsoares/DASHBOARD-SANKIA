import { useState } from 'react'
import { useSalesData } from '../api/dashboard'
import { formatBRL, formatNumber, toISODate } from '../lib/formatters'
import PeriodFilter from '../components/dashboard/PeriodFilter'
import SalesByVendorChart from '../components/dashboard/SalesByVendorChart'
import RefreshButton from '../components/RefreshButton'

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

function VendorRankingTable({ title, titleColor, vendors, months, loading, maxValue }) {
  const total = vendors.reduce((sum, v) => sum + v.totalValue, 0)
  const totalInvoices = vendors.reduce((sum, v) => sum + v.totalInvoices, 0)

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h3 className={`text-sm font-semibold ${titleColor}`}>{title}</h3>
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
            {vendors.map((v, i) => {
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
            {vendors.length === 0 && (
              <tr>
                <td colSpan={4 + months.length} className="px-4 py-8 text-center text-gray-400">
                  {loading ? 'Carregando dados... isso pode levar alguns minutos.' : 'Sem dados para o periodo.'}
                </td>
              </tr>
            )}
            {vendors.length > 0 && (
              <tr className="bg-gray-50 font-semibold border-t-2">
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-gray-700">Subtotal</td>
                <td className="px-4 py-3 text-right text-gray-800">{formatBRL(total)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{totalInvoices}</td>
                {months.map(m => {
                  const monthTotal = vendors.reduce((sum, v) => sum + (v.monthly?.[m]?.value || 0), 0)
                  const monthInvoices = vendors.reduce((sum, v) => sum + (v.monthly?.[m]?.invoices || 0), 0)
                  return (
                    <td key={m} className="px-3 py-3 text-right text-xs">
                      <span className="text-gray-700 font-medium">{formatBRL(monthTotal)}</span>
                      <span className="text-gray-400 block">{monthInvoices}x</span>
                    </td>
                  )
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SalesPage() {
  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [startDate, setStartDate] = useState(toISODate(defaultStart))
  const [endDate, setEndDate] = useState(toISODate(now))

  const { data: salesData, isLoading, isFetching } = useSalesData(startDate, endDate)

  const loading = isLoading || isFetching

  const handleFilter = (start, end) => {
    setStartDate(start)
    setEndDate(end)
  }

  const months = salesData?.months || []
  const vendorSalesAsx = salesData?.vendorSalesAsx || []
  const vendorSalesAbsolux = salesData?.vendorSalesAbsolux || []
  const allVendors = salesData?.vendorSales || []

  const maxValueAsx = vendorSalesAsx.length > 0 ? vendorSalesAsx[0].totalValue : 1
  const maxValueAbsolux = vendorSalesAbsolux.length > 0 ? vendorSalesAbsolux[0].totalValue : 1
  const grandTotal = allVendors.reduce((sum, v) => sum + v.totalValue, 0)
  const grandInvoices = allVendors.reduce((sum, v) => sum + v.totalInvoices, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800">Vendas por Periodo</h2>
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <span className="text-xs text-blue-500 flex items-center gap-1">
              <span className="animate-spin rounded-full h-3 w-3 border-b border-blue-500"></span>
              Atualizando...
            </span>
          )}
          <RefreshButton queryKeys={['sales-data']} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <PeriodFilter onFilter={handleFilter} defaultMonths={0} />
      </div>

      {isLoading && <LoadingBanner />}

      {/* Period Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-3 sm:p-5 border-l-4 border-green-500">
          <p className="text-[10px] sm:text-sm text-gray-500">Total Vendido</p>
          <p className="text-sm sm:text-2xl font-bold text-gray-900 mt-1">
            {isLoading ? '...' : formatBRL(salesData?.totalValue)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-5 border-l-4 border-blue-500">
          <p className="text-[10px] sm:text-sm text-gray-500">Notas</p>
          <p className="text-sm sm:text-2xl font-bold text-gray-900 mt-1">
            {isLoading ? '...' : formatNumber(salesData?.totalInvoices)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-5 border-l-4 border-purple-500">
          <p className="text-[10px] sm:text-sm text-gray-500">Vendedores</p>
          <p className="text-sm sm:text-2xl font-bold text-gray-900 mt-1">
            {isLoading ? '...' : formatNumber(allVendors.length)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <SalesByVendorChart data={allVendors} />
      </div>

      {/* Ranking ASX */}
      <div className="mb-6">
        <VendorRankingTable
          title="Ranking Vendas ASX"
          titleColor="text-blue-700"
          vendors={vendorSalesAsx}
          months={months}
          loading={loading}
          maxValue={maxValueAsx}
        />
      </div>

      {/* Ranking ABSOLUX */}
      <div className="mb-6">
        <VendorRankingTable
          title="Ranking Vendas ABSOLUX"
          titleColor="text-purple-700"
          vendors={vendorSalesAbsolux}
          months={months}
          loading={loading}
          maxValue={maxValueAbsolux}
        />
      </div>

      {/* Grand Total */}
      {allVendors.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600">TOTAL GERAL (ASX + ABSOLUX)</p>
              <p className="text-xs text-gray-400 mt-0.5">{grandInvoices} notas emitidas</p>
            </div>
            <p className="text-2xl font-bold text-green-700">{formatBRL(grandTotal)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
