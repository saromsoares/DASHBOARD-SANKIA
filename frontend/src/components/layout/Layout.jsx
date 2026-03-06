import Sidebar from './Sidebar'

export default function Layout({ children, currentPage, onNavigate }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
