import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import StockIndicator from './StockIndicator'
import { formatNumber } from '../../lib/formatters'
import { getStockStatus } from '../../lib/indicators'

const columns = [
  {
    accessorKey: 'codprod',
    header: 'Codigo',
    size: 80,
  },
  {
    accessorKey: 'descrprod',
    header: 'Produto',
    size: 300,
  },
  {
    accessorKey: 'referencia',
    header: 'Ref',
    size: 120,
  },
  {
    accessorKey: 'stock',
    header: 'Estoque',
    size: 100,
    cell: ({ getValue }) => formatNumber(getValue()),
  },
  {
    accessorKey: 'avgMonth',
    header: 'Media/Mes',
    size: 100,
    cell: ({ getValue }) => formatNumber(getValue(), 1),
  },
  {
    accessorKey: 'coverageMonths',
    header: 'Cobertura',
    size: 100,
    cell: ({ getValue }) => {
      const v = getValue()
      return v == null ? 'N/A' : `${formatNumber(v, 1)} meses`
    },
  },
  {
    id: 'status',
    header: 'Status',
    size: 120,
    accessorFn: (row) => row.status,
    cell: ({ row }) => {
      const status = getStockStatus(row.original.stock, row.original.avgMonth)
      return <StockIndicator status={status} />
    },
  },
]

export default function ProductTable({ data = [] }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <input
          type="text"
          placeholder="Buscar produto..."
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
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
                  <td key={cell.id} className="px-4 py-2.5 text-gray-700">
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
          {' '}({table.getFilteredRowModel().rows.length} itens)
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
  )
}
