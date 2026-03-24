import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { usePendingBilling, useSalesData } from '../api/dashboard'
import { formatBRL, formatNumber, toISODate } from '../lib/formatters'
import RefreshButton from '../components/RefreshButton'

function getDefaultDates() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startDate: toISODate(start), endDate: toISODate(now) }
}

export default function FaturamentoPage() {
  const { data: pending, isLoading: loadingPending, isFetching } = usePendingBilling()
  const { startDate, endDate } = getDefaultDates()
  const { data: salesData, isLoading: loadingSales } = useSalesData(startDate, endDate)

  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([{ id: 'vlrnota', desc: true }])

  const orders = pending?.orders || []
  const totalPending = pending?.totalValue || 0
  const totalFaturado = salesData?.totalValue || 0
  const totalGeral = totalFaturado + totalPending

  const columns = useMemo(() => [
    { accessorKey: 'nunota', header: 'Nota', size: 70 },
    {
      accessorKey: 'dtneg',
      header: 'Data',
      size: 90,
      cell: ({ getValue }) => {
        const v = getValue()
        return v || '-'
      },
    },
    {
      accessorKey: 'nomeparc',
      header: 'Cliente',
      size: 250,
      cell: ({ getValue }) => (
        <span className="truncate block max-w-[250px]" title={getValue()}>
          {getValue() || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'nomevend',
      header: 'Vendedor',
      size: 120,
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      accessorKey: 'vlrnota',
      header: 'Valor Total',
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-semibold text-gray-800">{formatBRL(getValue())}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      size: 110,
      cell: () => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
          Pendente
        </span>
      ),
    },
  ], [])

  const table = useReactTable({
    data: orders,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  if (loadingPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Carregando faturamento pendente...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Faturamento Pendente</h2>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Pedidos aprovados aguardando faturamento - mes atual</p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && (
            <span className="text-xs text-yellow-600 flex items-center gap-1">
              <span className="animate-spin rounded-full h-3 w-3 border-b border-yellow-500"></span>
              Atualizando...
            </span>
          )}
          <RefreshButton queryKeys={['pending-billing', 'sales-data']} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-l-4 border-green-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Faturado no Mes</p>
          <p className="text-sm sm:text-xl font-bold text-green-600">{loadingSales ? '...' : formatBRL(totalFaturado)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-l-4 border-yellow-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Pendente</p>
          <p className="text-sm sm:text-xl font-bold text-yellow-600">{formatBRL(totalPending)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-l-4 border-blue-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Total Geral</p>
          <p className="text-sm sm:text-xl font-bold text-blue-600">{loadingSales ? '...' : formatBRL(totalGeral)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-l-4 border-purple-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Pedidos Pendentes</p>
          <p className="text-sm sm:text-xl font-bold text-purple-600">{formatNumber(orders.length)}</p>
        </div>
      </div>

      {/* Progress bar */}
      {!loadingSales && totalGeral > 0 && (
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-gray-500">Faturado vs Pendente</span>
            <span className="font-medium text-gray-700">{((totalFaturado / totalGeral) * 100).toFixed(1)}% faturado</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(totalFaturado / totalGeral) * 100}%` }}
            />
            <div
              className="h-full bg-yellow-400 transition-all"
              style={{ width: `${(totalPending / totalGeral) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] sm:text-xs mt-1">
            <span className="text-green-600">Faturado: {formatBRL(totalFaturado)}</span>
            <span className="text-yellow-600">Pendente: {formatBRL(totalPending)}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-3 sm:p-4 border-b">
          <input
            type="text"
            placeholder="Buscar por cliente, vendedor, nota..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full sm:max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-3 py-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted()] ?? ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400 text-sm">
                    Nenhum pedido pendente de faturamento.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {orders.length > 25 && (
          <div className="flex items-center justify-between p-4 border-t text-sm text-gray-500">
            <span>
              Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              {' '}({table.getFilteredRowModel().rows.length} pedidos)
            </span>
            <div className="flex gap-2">
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100">Anterior</button>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100">Proximo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
