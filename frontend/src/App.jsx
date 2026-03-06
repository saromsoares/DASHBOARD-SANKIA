import { useState } from 'react'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import SalesPage from './pages/SalesPage'
import ComprasPage from './pages/ComprasPage'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'sales' && <SalesPage />}
      {currentPage === 'compras' && <ComprasPage />}
    </Layout>
  )
}

export default App
