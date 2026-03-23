import { useMemo } from 'react'
import { useSalesData, useTopProductsAsx } from '../api/dashboard'
import { toISODate } from '../lib/formatters'
import RefreshButton from '../components/RefreshButton'
import KPICards from '../components/dashboard/KPICards'
import SalesByVendorChart from '../components/dashboard/SalesByVendorChart'
import SalesTrendChart from '../components/dashboard/SalesTrendChart'
import TopProductsASX from '../components/dashboard/TopProductsASX'

function getDefaultDates() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startDate: toISODate(start), endDate: toISODate(now) }
}

export default function DashboardPage() {
  const { startDate, endDate } = useMemo(getDefaultDates, [])

  const { data: salesData, isLoading: loadingSales, isError: salesError } = useSalesData(startDate, endDate)
  const { data: topProducts, isLoading: loadingTopProducts } = useTopProductsAsx()

  const vendorCount = salesData?.vendorSales?.length || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>
        <RefreshButton queryKeys={['sales-data', 'top-products-asx']} />
      </div>

      {salesError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-red-800">Erro ao carregar dados de vendas. Tente atualizar a pagina.</p>
        </div>
      )}

      {loadingSales ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      ) : (
        <KPICards periodSales={salesData} vendorCount={vendorCount} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <SalesByVendorChart data={salesData?.vendorSales || []} />
        <SalesTrendChart topBuyers={salesData?.topBuyers || []} />
      </div>

      <TopProductsASX data={topProducts} isLoading={loadingTopProducts} />
    </div>
  )
}
