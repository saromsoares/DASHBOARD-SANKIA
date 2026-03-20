import { useState } from 'react'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import SalesPage from './pages/SalesPage'
import FaturamentoPage from './pages/FaturamentoPage'
import ComprasPage from './pages/ComprasPage'
import SugestaoCompraPage from './pages/SugestaoCompraPage'
import ImportacaoPage from './pages/ImportacaoPage'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'sales' && <SalesPage />}
      {currentPage === 'faturamento' && <FaturamentoPage />}
      {currentPage === 'compras' && <ComprasPage />}
      {currentPage === 'sugestao' && <SugestaoCompraPage />}
      {currentPage === 'importacao' && <ImportacaoPage />}
    </Layout>
  )
}

export default App
