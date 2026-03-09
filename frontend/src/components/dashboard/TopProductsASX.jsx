import { formatNumber, formatBRL } from '../../lib/formatters'

function ProductRankTable({ title, subtitle, data, emptyMsg, rankBy }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-xs font-semibold text-gray-700">{title}</h3>
        <p className="text-gray-400 text-xs mt-3">{emptyMsg}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-3 py-2.5 border-b">
        <h3 className="text-xs font-semibold text-gray-700">{title}</h3>
        {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium text-gray-500 w-6">#</th>
            <th className="px-2 py-1.5 text-left font-medium text-gray-500">Produto</th>
            <th className="px-2 py-1.5 text-left font-medium text-gray-500">Ref Forn</th>
            <th className="px-2 py-1.5 text-right font-medium text-gray-500 whitespace-nowrap">Qtd</th>
            <th className="px-2 py-1.5 text-right font-medium text-gray-500 whitespace-nowrap">Valor</th>
            <th className="px-2 py-1.5 text-right font-medium text-gray-500">Estoque</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => {
            return (
              <tr key={p.codprod} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-2 py-1">
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                    i === 0 ? 'bg-yellow-400 text-yellow-900'
                    : i === 1 ? 'bg-gray-300 text-gray-700'
                    : i === 2 ? 'bg-orange-300 text-orange-800'
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-2 py-1 truncate max-w-[200px] text-gray-800" title={p.descrprod}>
                  {p.descrprod}
                </td>
                <td className="px-2 py-1 truncate max-w-[100px] text-gray-500 text-[10px]" title={p.refforn || '-'}>
                  {p.refforn || '-'}
                </td>
                <td className={`px-2 py-1 text-right whitespace-nowrap ${rankBy === 'qty' ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                  {formatNumber(p.qtdTotal)}
                </td>
                <td className={`px-2 py-1 text-right whitespace-nowrap ${rankBy === 'value' ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                  {formatBRL(p.vlrTotal)}
                </td>
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  <span className="text-gray-600">{formatNumber(p.stock)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function TopProductsASX({ data, isLoading }) {
  if (isLoading || data?.loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {[0,1].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <span className="text-xs">Carregando produtos...</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <ProductRankTable
        title="Top 10 Mais Vendidos (por Quantidade)"
        subtitle="Mes atual - ordenado por quantidade de itens vendidos"
        data={data?.topByQty || []}
        emptyMsg="Sem dados de vendas."
        rankBy="qty"
      />
      <ProductRankTable
        title="Top 10 Mais Vendidos (por Valor)"
        subtitle="Mes atual - ordenado por valor total vendido"
        data={data?.topByValue || []}
        emptyMsg="Sem dados de vendas."
        rankBy="value"
      />
    </div>
  )
}
