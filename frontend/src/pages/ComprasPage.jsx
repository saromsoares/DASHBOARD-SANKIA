import { useState, useMemo, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { usePurchaseManagement, useSearchPartners } from '../api/dashboard'
import StockIndicator from '../components/dashboard/StockIndicator'
import { formatNumber } from '../lib/formatters'

const STATUS_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'critico', label: 'Critico' },
  { key: 'atencao', label: 'Atencao' },
  { key: 'repor', label: 'Repor' },
  { key: 'ok', label: 'OK' },
]

const STATUS_MAP = {
  critico: { label: 'Critico', color: 'red' },
  atencao: { label: 'Atencao', color: 'yellow' },
  repor: { label: 'Repor', color: 'orange' },
  ok: { label: 'OK', color: 'green' },
  sem_media: { label: 'Sem Media', color: 'gray' },
}

const COLOR_MAP = {
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
}

const BASE_COLUMNS = [
  { accessorKey: 'codprod', header: 'Codigo', size: 70 },
  { accessorKey: 'descrprod', header: 'Produto', size: 280 },
  { accessorKey: 'referencia', header: 'Ref', size: 100 },
]

const FORNECEDOR_COLUMN = {
  accessorKey: 'nomeforn',
  header: 'Fornecedor',
  size: 160,
  cell: ({ getValue }) => {
    const v = getValue()
    return v ? <span className="text-gray-600" title={v}>{v}</span> : <span className="text-gray-300">-</span>
  },
}

const COMMON_COLUMNS = [
  {
    accessorKey: 'stock',
    header: 'Estoque Atual',
    size: 100,
    cell: ({ getValue }) => <span className="font-medium">{formatNumber(getValue())}</span>,
  },
  {
    accessorKey: 'avg6m',
    header: 'Media Venda/Mes (6M)',
    size: 140,
    cell: ({ getValue }) => formatNumber(getValue(), 1),
  },
  {
    accessorKey: 'duracao',
    header: 'Estoque Dura (meses)',
    size: 140,
    cell: ({ getValue }) => {
      const v = getValue()
      if (v == null) return <span className="text-gray-400">-</span>
      const cls = v < 1 ? 'text-red-600 font-bold' : v < 3 ? 'text-yellow-600 font-semibold' : v < 6 ? 'text-orange-500 font-medium' : 'text-green-600'
      return <span className={cls}>{formatNumber(v, 1)} meses</span>
    },
  },
  {
    accessorKey: 'need3m',
    header: 'Comprar p/ 3M',
    size: 110,
    cell: ({ getValue }) => {
      const v = getValue()
      return v > 0 ? (
        <span className="text-orange-600 font-semibold">{formatNumber(v)}</span>
      ) : (
        <span className="text-green-500 text-xs">Abastecido</span>
      )
    },
  },
  {
    accessorKey: 'need6m',
    header: 'Comprar p/ 6M',
    size: 110,
    cell: ({ getValue }) => {
      const v = getValue()
      return v > 0 ? (
        <span className="text-red-600 font-semibold">{formatNumber(v)}</span>
      ) : (
        <span className="text-green-500 text-xs">Abastecido</span>
      )
    },
  },
  {
    id: 'status',
    header: 'Status',
    size: 100,
    accessorFn: (row) => row.status,
    cell: ({ row }) => {
      const s = STATUS_MAP[row.original.status] || STATUS_MAP.sem_media
      return <StockIndicator status={s} />
    },
  },
]

const columnsAsx = [...BASE_COLUMNS, ...COMMON_COLUMNS]
const columnsAbsolux = [...BASE_COLUMNS, FORNECEDOR_COLUMN, ...COMMON_COLUMNS]

function ComprasTable({ data = [], columns, fornecedorFilter }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredData = useMemo(() => {
    let filtered = data
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter)
    }
    if (fornecedorFilter) {
      filtered = filtered.filter(item => String(item.codparcforn) === String(fornecedorFilter))
    }
    return filtered
  }, [data, statusFilter, fornecedorFilter])

  const summary = useMemo(() => {
    const criticos = data.filter(i => i.status === 'critico').length
    const atencao = data.filter(i => i.status === 'atencao').length
    const repor = data.filter(i => i.status === 'repor').length
    const ok = data.filter(i => i.status === 'ok').length
    return { total: data.length, criticos, atencao, repor, ok }
  }, [data])

  const table = useReactTable({
    data: filteredData,
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

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-blue-500">
          <p className="text-xs text-gray-500">Total Produtos</p>
          <p className="text-lg font-bold text-gray-800">{formatNumber(summary.total)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-red-500">
          <p className="text-xs text-gray-500">Critico (&lt;1 mes)</p>
          <p className="text-lg font-bold text-red-600">{formatNumber(summary.criticos)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-yellow-500">
          <p className="text-xs text-gray-500">Atencao (1-3 meses)</p>
          <p className="text-lg font-bold text-yellow-600">{formatNumber(summary.atencao)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-orange-400">
          <p className="text-xs text-gray-500">Repor (3-6 meses)</p>
          <p className="text-lg font-bold text-orange-500">{formatNumber(summary.repor)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-green-500">
          <p className="text-xs text-gray-500">OK (&gt;6 meses)</p>
          <p className="text-lg font-bold text-green-600">{formatNumber(summary.ok)}</p>
        </div>
      </div>

      {/* Filters + Table */}
      <div className="bg-white rounded-lg shadow mb-4">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar produto, codigo, referencia..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="flex-1 min-w-[200px] max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  statusFilter === f.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
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
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t text-sm text-gray-500">
          <span>
            Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
            {' '}({filteredData.length} itens)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
            >
              Anterior
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
            >
              Proximo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'asx', label: 'Compras ASX' },
  { key: 'absolux', label: 'Compras ABSOLUX' },
]

function FornecedorFilter({ selected, selectedName, onApply, onClear }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [pending, setPending] = useState(null)
  const [pendingName, setPendingName] = useState('')

  const { data: suggestions = [], isFetching } = useSearchPartners(debouncedTerm)

  // Debounce: atualiza o termo de busca apos 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const handleSelect = (p) => {
    setPending(p.codparc)
    setPendingName(p.nomeparc)
    setSearchTerm(p.nomeparc)
    setShowDropdown(false)
  }

  const handleOk = () => {
    if (pending) {
      onApply(pending, pendingName)
      setShowDropdown(false)
    } else if (suggestions.length === 1) {
      onApply(suggestions[0].codparc, suggestions[0].nomeparc)
      setSearchTerm(suggestions[0].nomeparc)
      setShowDropdown(false)
    }
  }

  const handleClear = () => {
    onClear()
    setPending(null)
    setPendingName('')
    setSearchTerm('')
    setDebouncedTerm('')
    setShowDropdown(false)
  }

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value)
    setPending(null)
    setPendingName('')
    setShowDropdown(true)
  }

  return (
    <div className="bg-white rounded-lg shadow p-3 mb-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Fornecedor:</label>
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Digite o nome ou codigo do parceiro/fornecedor..."
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={() => { if (searchTerm.length >= 2) setShowDropdown(true) }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {isFetching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
            </div>
          )}
          {showDropdown && debouncedTerm.length >= 2 && suggestions.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map(p => (
                <button
                  key={p.codparc}
                  onClick={() => handleSelect(p)}
                  className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors flex items-center justify-between hover:bg-purple-50 ${
                    pending === p.codparc ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-gray-700'
                  }`}
                >
                  <span className="truncate">{p.nomeparc}</span>
                  <span className="text-xs text-gray-400 ml-2 flex-shrink-0">Cod: {p.codparc}</span>
                </button>
              ))}
            </div>
          )}
          {showDropdown && debouncedTerm.length >= 2 && !isFetching && suggestions.length === 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
              <p className="text-xs text-gray-400 text-center">Nenhum parceiro encontrado</p>
            </div>
          )}
        </div>
        <button
          onClick={handleOk}
          disabled={!pending && suggestions.length !== 1}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-md hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          OK
        </button>
        {selected && (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-md hover:bg-red-200 transition-colors"
          >
            Remover Filtro
          </button>
        )}
      </div>
      {selected && selectedName && (
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
            Filtrando por: {selectedName}
          </span>
        </div>
      )}
    </div>
  )
}

export default function ComprasPage() {
  const { data, isLoading, isFetching } = usePurchaseManagement()
  const [activeTab, setActiveTab] = useState('asx')
  const [fornecedorFilter, setFornecedorFilter] = useState(null)
  const [fornecedorName, setFornecedorName] = useState('')

  const isWarmingUp = data?.loading === true

  if (isLoading || isWarmingUp) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Preparando dados de compras...</p>
          <p className="text-gray-400 text-xs mt-1">O servidor esta processando os dados do Sankhya em background.</p>
          <p className="text-gray-400 text-xs">A pagina vai carregar automaticamente quando estiver pronto.</p>
        </div>
      </div>
    )
  }

  const asxData = data?.asx || []
  const absoluxData = data?.absolux || []
  const currentData = activeTab === 'asx' ? asxData : absoluxData

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gestao de Compras</h2>
          <p className="text-xs text-gray-500 mt-1">Produtos com vendas nos ultimos 6 meses - media mensal e sugestao de compra</p>
        </div>
        {isFetching && (
          <span className="text-xs text-blue-500 flex items-center gap-1">
            <span className="animate-spin rounded-full h-3 w-3 border-b border-blue-500"></span>
            Atualizando...
          </span>
        )}
      </div>

      {/* Tabs ASX / ABSOLUX */}
      <div className="flex gap-1 mb-4">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setFornecedorFilter(null); setFornecedorName('') }}
            className={`px-5 py-2.5 rounded-t-lg text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? tab.key === 'asx'
                  ? 'bg-blue-600 text-white'
                  : 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/20">
              {tab.key === 'asx' ? asxData.length : absoluxData.length}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'absolux' && (
        <FornecedorFilter
          selected={fornecedorFilter}
          selectedName={fornecedorName}
          onApply={(codparc, nome) => { setFornecedorFilter(codparc); setFornecedorName(nome) }}
          onClear={() => { setFornecedorFilter(null); setFornecedorName('') }}
        />
      )}

      <ComprasTable
        data={currentData}
        columns={activeTab === 'absolux' ? columnsAbsolux : columnsAsx}
        fornecedorFilter={activeTab === 'absolux' ? fornecedorFilter : null}
      />
    </div>
  )
}
