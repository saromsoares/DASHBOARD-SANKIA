import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatBRL } from '../../lib/formatters'

export default function SalesByVendorChart({ data = [] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Vendas por Vendedor</h3>
        <p className="text-gray-400 text-sm">Sem dados para o periodo selecionado.</p>
      </div>
    )
  }

  const chartData = data.slice(0, 10).map(v => ({
    name: v.nome?.length > 12 ? v.nome.substring(0, 12) + '...' : v.nome,
    valor: v.totalValue,
    notas: v.totalInvoices,
  }))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Vendas por Vendedor (Top 10)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={v => formatBRL(v)} />
          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
          <Tooltip formatter={v => formatBRL(v)} />
          <Bar dataKey="valor" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
