import { useState, useMemo, useEffect, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useImportacoes, useSearchProductsAsx } from '../api/dashboard'
import { formatNumber } from '../lib/formatters'

const STATUS_LABELS = {
  em_transito: { label: 'Em Transito', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  recebido: { label: 'Recebido', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  cancelado: { label: 'Cancelado', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
}

const STATUS_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'em_transito', label: 'Em Transito' },
  { key: 'recebido', label: 'Recebidos' },
]

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.em_transito
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
      {s.label}
    </span>
  )
}

function diasAteChegada(previsaoChegada) {
  if (!previsaoChegada) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prev = new Date(previsaoChegada + 'T00:00:00')
  const diff = Math.ceil((prev - hoje) / (1000 * 60 * 60 * 24))
  return diff
}

function ProductSearch({ onSelect }) {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef(null)

  const { data: results = [], isFetching } = useSearchProductsAsx(debouncedTerm)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), 300)
    return () => clearTimeout(timer)
  }, [term])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (p) => {
    onSelect(p)
    setTerm('')
    setShowDropdown(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder="Buscar produto por codigo, nome ou referencia..."
        value={term}
        onChange={e => { setTerm(e.target.value); setShowDropdown(true) }}
        onFocus={() => { if (term.length >= 2) setShowDropdown(true) }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {isFetching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
        </div>
      )}
      {showDropdown && debouncedTerm.length >= 2 && results.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.codprod}
              onClick={() => handleSelect(p)}
              className="w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-indigo-50 flex items-center justify-between"
            >
              <span className="truncate">
                <span className="font-medium text-gray-800">{p.codprod}</span>
                <span className="text-gray-500 ml-2">{p.descrprod}</span>
              </span>
              {p.referencia && <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{p.referencia}</span>}
            </button>
          ))}
        </div>
      )}
      {showDropdown && debouncedTerm.length >= 2 && !isFetching && results.length === 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-xs text-gray-400 text-center">Nenhum produto ASX encontrado</p>
        </div>
      )}
    </div>
  )
}

function AddImportForm({ onAdd, onCancel }) {
  const [product, setProduct] = useState(null)
  const [form, setForm] = useState({
    quantidade: '',
    dataCompra: new Date().toISOString().slice(0, 10),
    previsaoChegada: '',
    numeroPedido: '',
    fornecedor: '',
    observacao: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!product || !form.quantidade) return
    onAdd({
      codprod: product.codprod,
      descrprod: product.descrprod,
      referencia: product.referencia,
      ...form,
      quantidade: Number(form.quantidade),
    })
    setProduct(null)
    setForm({ quantidade: '', dataCompra: new Date().toISOString().slice(0, 10), previsaoChegada: '', numeroPedido: '', fornecedor: '', observacao: '' })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-5 mb-4 border-l-4 border-indigo-500">
      <h3 className="text-sm font-bold text-gray-700 mb-3">Nova Importacao em Transito</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Produto ASX *</label>
          {product ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-md border border-indigo-200">
              <span className="text-sm font-medium text-indigo-800">{product.codprod}</span>
              <span className="text-sm text-gray-600">{product.descrprod}</span>
              <button type="button" onClick={() => setProduct(null)} className="ml-auto text-red-500 hover:text-red-700 text-xs font-bold">X</button>
            </div>
          ) : (
            <ProductSearch onSelect={setProduct} />
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Quantidade *</label>
          <input
            type="number"
            min="1"
            value={form.quantidade}
            onChange={e => setForm(prev => ({ ...prev, quantidade: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data da Compra</label>
          <input
            type="date"
            value={form.dataCompra}
            onChange={e => setForm(prev => ({ ...prev, dataCompra: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Previsao de Chegada</label>
          <input
            type="date"
            value={form.previsaoChegada}
            onChange={e => setForm(prev => ({ ...prev, previsaoChegada: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Numero do Pedido / Invoice</label>
          <input
            type="text"
            value={form.numeroPedido}
            onChange={e => setForm(prev => ({ ...prev, numeroPedido: e.target.value }))}
            placeholder="Ex: PO-2026-001"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fornecedor</label>
          <input
            type="text"
            value={form.fornecedor}
            onChange={e => setForm(prev => ({ ...prev, fornecedor: e.target.value }))}
            placeholder="Nome do fornecedor"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Observacao</label>
          <input
            type="text"
            value={form.observacao}
            onChange={e => setForm(prev => ({ ...prev, observacao: e.target.value }))}
            placeholder="Notas adicionais..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!product || !form.quantidade}
          className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Adicionar Importacao
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 bg-gray-100 text-gray-600 text-sm font-semibold rounded-md hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function ImportacaoPage() {
  const { data: importacoes = [], isLoading, refetch } = useImportacoes()
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([{ id: 'criadoEm', desc: true }])

  const handleAdd = async (entry) => {
    try {
      const res = await fetch('/api/dashboard/importacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      if (res.ok) {
        refetch()
        setShowForm(false)
      }
    } catch (err) {
      console.error('Erro ao adicionar importacao:', err)
    }
  }

  const handleRecebido = async (id) => {
    try {
      const res = await fetch(`/api/dashboard/importacoes/${id}/recebido`, { method: 'PUT' })
      if (res.ok) refetch()
    } catch (err) {
      console.error('Erro ao marcar recebido:', err)
    }
  }

  const handleRemove = async (id) => {
    if (!confirm('Cancelar esta importacao?')) return
    try {
      const res = await fetch(`/api/dashboard/importacoes/${id}`, { method: 'DELETE' })
      if (res.ok) refetch()
    } catch (err) {
      console.error('Erro ao cancelar importacao:', err)
    }
  }

  const filteredData = useMemo(() => {
    let filtered = importacoes
    if (statusFilter !== 'all') {
      filtered = filtered.filter(i => i.status === statusFilter)
    }
    return filtered
  }, [importacoes, statusFilter])

  const summary = useMemo(() => {
    const emTransito = importacoes.filter(i => i.status === 'em_transito')
    const totalQtd = emTransito.reduce((sum, i) => sum + i.quantidade, 0)
    const produtos = new Set(emTransito.map(i => i.codprod)).size
    const atrasados = emTransito.filter(i => {
      const dias = diasAteChegada(i.previsaoChegada)
      return dias !== null && dias < 0
    }).length
    const recebidos = importacoes.filter(i => i.status === 'recebido').length
    return { emTransito: emTransito.length, totalQtd, produtos, atrasados, recebidos }
  }, [importacoes])

  const columns = useMemo(() => [
    { accessorKey: 'codprod', header: 'Codigo', size: 70 },
    { accessorKey: 'descrprod', header: 'Produto', size: 250 },
    { accessorKey: 'referencia', header: 'Ref', size: 90 },
    {
      accessorKey: 'quantidade',
      header: 'Qtd',
      size: 70,
      cell: ({ getValue }) => <span className="font-semibold">{formatNumber(getValue())}</span>,
    },
    {
      accessorKey: 'fornecedor',
      header: 'Fornecedor',
      size: 140,
      cell: ({ getValue }) => getValue() || <span className="text-gray-300">-</span>,
    },
    {
      accessorKey: 'numeroPedido',
      header: 'Pedido',
      size: 120,
      cell: ({ getValue }) => getValue() || <span className="text-gray-300">-</span>,
    },
    {
      accessorKey: 'dataCompra',
      header: 'Data Compra',
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue()
        if (!v) return <span className="text-gray-300">-</span>
        const [y, m, d] = v.split('-')
        return <span>{d}/{m}/{y}</span>
      },
    },
    {
      accessorKey: 'previsaoChegada',
      header: 'Previsao Chegada',
      size: 130,
      cell: ({ getValue }) => {
        const v = getValue()
        if (!v) return <span className="text-gray-300">-</span>
        const dias = diasAteChegada(v)
        const [y, m, d] = v.split('-')
        const dateStr = `${d}/${m}/${y}`
        if (dias === null) return <span>{dateStr}</span>
        if (dias < 0) return <span className="text-red-600 font-semibold">{dateStr} <span className="text-xs">({Math.abs(dias)}d atrasado)</span></span>
        if (dias === 0) return <span className="text-green-600 font-semibold">{dateStr} <span className="text-xs">(Hoje!)</span></span>
        if (dias <= 7) return <span className="text-yellow-600 font-medium">{dateStr} <span className="text-xs">({dias}d)</span></span>
        return <span className="text-gray-700">{dateStr} <span className="text-xs text-gray-400">({dias}d)</span></span>
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 110,
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    },
    {
      id: 'acoes',
      header: 'Acoes',
      size: 140,
      cell: ({ row }) => {
        const item = row.original
        if (item.status !== 'em_transito') return null
        return (
          <div className="flex gap-1">
            <button
              onClick={() => handleRecebido(item.id)}
              className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              Recebido
            </button>
            <button
              onClick={() => handleRemove(item.id)}
              className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )
      },
    },
  ], [])

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Carregando importacoes...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Importacoes em Transito</h2>
          <p className="text-xs text-gray-500 mt-1">Produtos ASX comprados e em transito - impacta no calculo de duracao do estoque</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            showForm
              ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {showForm ? 'Fechar Formulario' : '+ Nova Importacao'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-blue-500">
          <p className="text-xs text-gray-500">Em Transito</p>
          <p className="text-lg font-bold text-blue-600">{formatNumber(summary.emTransito)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-indigo-500">
          <p className="text-xs text-gray-500">Total Pecas</p>
          <p className="text-lg font-bold text-indigo-600">{formatNumber(summary.totalQtd)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-purple-500">
          <p className="text-xs text-gray-500">Produtos Distintos</p>
          <p className="text-lg font-bold text-purple-600">{formatNumber(summary.produtos)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-red-500">
          <p className="text-xs text-gray-500">Atrasados</p>
          <p className="text-lg font-bold text-red-600">{formatNumber(summary.atrasados)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 border-l-4 border-green-500">
          <p className="text-xs text-gray-500">Recebidos</p>
          <p className="text-lg font-bold text-green-600">{formatNumber(summary.recebidos)}</p>
        </div>
      </div>

      {showForm && <AddImportForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />}

      {/* Filters + Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por produto, codigo, pedido, fornecedor..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="flex-1 min-w-[200px] max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  statusFilter === f.key
                    ? 'bg-indigo-600 text-white'
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
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400 text-sm">
                    Nenhuma importacao registrada. Clique em "+ Nova Importacao" para comecar.
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

        {filteredData.length > 25 && (
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
        )}
      </div>
    </div>
  )
}
