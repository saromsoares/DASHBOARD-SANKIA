import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { usePurchaseManagement } from '../api/dashboard'
import StockIndicator from '../components/dashboard/StockIndicator'
import { formatNumber } from '../lib/formatters'
import RefreshButton from '../components/RefreshButton'

const STATUS_MAP = {
  critico: { label: 'Critico', color: 'red' },
  atencao: { label: 'Atencao', color: 'yellow' },
  repor: { label: 'Repor', color: 'orange' },
}

const PERIOD_OPTIONS = [
  { key: '3m', label: '3 Meses', field: 'need3m' },
  { key: '6m', label: '6 Meses', field: 'need6m' },
]

export default function SugestaoCompraPage() {
  const { data, isLoading } = usePurchaseManagement()
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([{ id: 'duracao', desc: false }])
  const [periodo, setPeriodo] = useState('6m')
  const [activeTab, setActiveTab] = useState('asx')

  const isWarmingUp = data?.loading === true

  const needField = PERIOD_OPTIONS.find(p => p.key === periodo)?.field || 'need6m'

  const allProducts = useMemo(() => {
    if (!data) return []
    const source = activeTab === 'asx' ? (data.asx || []) : (data.absolux || [])
    // Filter: only products that need restocking (duration < 6 months)
    return source.filter(p =>
      p.status === 'critico' || p.status === 'atencao' || p.status === 'repor'
    )
  }, [data, activeTab])

  const summary = useMemo(() => {
    const criticos = allProducts.filter(p => p.status === 'critico')
    const atencao = allProducts.filter(p => p.status === 'atencao')
    const repor = allProducts.filter(p => p.status === 'repor')
    const totalNeed = allProducts.reduce((sum, p) => sum + (p[needField] || 0), 0)
    return {
      total: allProducts.length,
      criticos: criticos.length,
      atencao: atencao.length,
      repor: repor.length,
      totalNeed,
    }
  }, [allProducts, needField])

  const columns = useMemo(() => [
    { accessorKey: 'codprod', header: 'Cod', size: 60 },
    {
      accessorKey: 'descrprod',
      header: 'Produto',
      size: 250,
      cell: ({ getValue }) => (
        <span className="truncate block max-w-[250px]" title={getValue()}>{getValue()}</span>
      ),
    },
    { accessorKey: 'referencia', header: 'Ref', size: 80 },
    {
      accessorKey: 'refforn',
      header: 'Ref Forn',
      size: 100,
      cell: ({ getValue }) => getValue() || <span className="text-gray-300">-</span>,
    },
    {
      accessorKey: 'stock',
      header: 'Estoque',
      size: 80,
      cell: ({ getValue }) => <span className="font-medium">{formatNumber(getValue())}</span>,
    },
    {
      accessorKey: 'emTransito',
      header: 'Transito',
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue()
        if (!v) return <span className="text-gray-300">-</span>
        return <span className="text-blue-600 font-medium">+{formatNumber(v)}</span>
      },
    },
    {
      accessorKey: 'avg6m',
      header: 'Media/Mes',
      size: 90,
      cell: ({ getValue }) => formatNumber(getValue(), 1),
    },
    {
      accessorKey: 'duracao',
      header: 'Dura (meses)',
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue()
        if (v == null) return <span className="text-gray-400">-</span>
        const cls = v < 1 ? 'text-red-600 font-bold' : v < 3 ? 'text-yellow-600 font-semibold' : 'text-orange-500 font-medium'
        return <span className={cls}>{formatNumber(v, 1)}</span>
      },
    },
    {
      id: 'sugestao',
      header: `Comprar (${periodo})`,
      size: 110,
      accessorFn: (row) => row[needField],
      cell: ({ getValue }) => {
        const v = getValue()
        if (!v || v <= 0) return <span className="text-gray-300">-</span>
        return <span className="text-red-600 font-bold text-base">{formatNumber(v)}</span>
      },
    },
    {
      id: 'status',
      header: 'Status',
      size: 90,
      accessorFn: (row) => row.status,
      cell: ({ row }) => {
        const s = STATUS_MAP[row.original.status]
        if (!s) return null
        return <StockIndicator status={s} />
      },
    },
  ], [needField, periodo])

  const table = useReactTable({
    data: allProducts,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  })

  if (isLoading || isWarmingUp) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Calculando sugestoes de compra...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Sugestao de Compra</h2>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Produtos com estoque para menos de 6 meses - considere estoque + transito</p>
        </div>
        <RefreshButton queryKeys={['purchase-management']} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-4">
        <div className="bg-white rounded-lg shadow p-2 sm:p-3 border-l-4 border-orange-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Precisam Comprar</p>
          <p className="text-sm sm:text-lg font-bold text-orange-600">{formatNumber(summary.total)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-3 border-l-4 border-red-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Critico (&lt;1 mes)</p>
          <p className="text-sm sm:text-lg font-bold text-red-600">{formatNumber(summary.criticos)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-3 border-l-4 border-yellow-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Atencao (1-3m)</p>
          <p className="text-sm sm:text-lg font-bold text-yellow-600">{formatNumber(summary.atencao)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-3 border-l-4 border-orange-400">
          <p className="text-[10px] sm:text-xs text-gray-500">Repor (3-6m)</p>
          <p className="text-sm sm:text-lg font-bold text-orange-500">{formatNumber(summary.repor)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-3 border-l-4 border-blue-500">
          <p className="text-[10px] sm:text-xs text-gray-500">Total a Comprar ({periodo})</p>
          <p className="text-sm sm:text-lg font-bold text-blue-600">{formatNumber(summary.totalNeed)}</p>
        </div>
      </div>

      {/* Tabs + Period selector */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          {[{ key: 'asx', label: 'ASX' }, { key: 'absolux', label: 'ABSOLUX' }].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-5 py-2 rounded-t-lg text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                periodo === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-3 sm:p-4 border-b">
          <input
            type="text"
            placeholder="Buscar produto, codigo, referencia..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full sm:max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    Todos os produtos estao abastecidos para mais de 6 meses!
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className={`border-b hover:bg-gray-50 ${
                    row.original.status === 'critico' ? 'bg-red-50/50' : ''
                  }`}>
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

        {allProducts.length > 50 && (
          <div className="flex items-center justify-between p-4 border-t text-sm text-gray-500">
            <span>
              Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              {' '}({table.getFilteredRowModel().rows.length} produtos)
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
