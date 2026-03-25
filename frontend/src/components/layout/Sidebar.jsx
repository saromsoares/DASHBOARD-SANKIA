const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'sales', label: 'Vendas', icon: '💰' },
  { key: 'faturamento', label: 'Faturamento', icon: '📋' },
  { key: 'compras', label: 'Compras', icon: '📦' },
  { key: 'sugestao', label: 'Sugestao Compra', icon: '🛒' },
  { key: 'importacao', label: 'Importacao', icon: '🚢' },
  { key: 'prospeccao', label: 'Prospeccao', icon: '🎯' },
]

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">ASX Dashboard</h1>
        <p className="text-xs text-gray-400 mt-1">Sankhya ERP</p>
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
              currentPage === item.key
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span>{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        v2.0
      </div>
    </aside>
  )
}
