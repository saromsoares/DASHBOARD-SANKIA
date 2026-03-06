import { useMemo } from 'react'
import { useSalesData, useTopProductsAsx } from '../api/dashboard'
import { toISODate } from '../lib/formatters'
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

  const { data: salesData } = useSalesData(startDate, endDate)
  const { data: topProducts, isLoading: loadingTopProducts } = useTopProductsAsx()

  const vendorCount = salesData?.vendorSales?.length || 0

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Dashboard</h2>

      <KPICards
        periodSales={salesData}
        vendorCount={vendorCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesByVendorChart data={salesData?.vendorSales || []} />
        <SalesTrendChart topBuyers={salesData?.topBuyers || []} />
      </div>

      <TopProductsASX data={topProducts} isLoading={loadingTopProducts} />
    </div>
  )
}
