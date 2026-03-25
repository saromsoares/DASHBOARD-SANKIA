import { useState, useMemo } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useProspeccao, useProspeccaoVendedores } from '../api/dashboard'
import api from '../api/client'
import RefreshButton from '../components/RefreshButton'

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  contatado: { label: 'Contatado', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  prospectado: { label: 'Prospectado', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  sem_interesse: { label: 'Sem Interesse', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
}

const STATUS_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'pendente', label: 'Pendente' },
  { key: 'contatado', label: 'Contatado' },
  { key: 'prospectado', label: 'Prospectado' },
  { key: 'sem_interesse', label: 'Sem Interesse' },
]

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.pendente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
      {s.label}
    </span>
  )
}

function AddLeadForm({ vendedores, onAdd }) {
  const [vendedorId, setVendedorId] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [observacao, setObservacao] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!vendedorId || !clienteNome.trim()) return
    onAdd({ vendedorId, clienteNome: clienteNome.trim(), clienteTelefone, clienteEmail, observacao })
    setClienteNome('')
    setClienteTelefone('')
    setClienteEmail('')
    setObservacao('')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Adicionar Lead</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <select
          value={vendedorId}
          onChange={e => setVendedorId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Vendedor...</option>
          {vendedores.map(v => (
            <option key={v.id} value={v.id}>
              {v.nome}{v.equipe ? ` - ${v.equipe}` : ''}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Nome do cliente *"
          value={clienteNome}
          onChange={e => setClienteNome(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
        <input
          type="text"
          placeholder="Telefone"
          value={clienteTelefone}
          onChange={e => setClienteTelefone(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <input
          type="text"
          placeholder="Email"
          value={clienteEmail}
          onChange={e => setClienteEmail(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Observacao"
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            + Lead
          </button>
        </div>
      </div>
    </form>
  )
}

function LeadRow({ lead, vendedor, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [obs, setObs] = useState(lead.observacao || '')

  const handleStatusChange = (newStatus) => {
    onUpdate(lead.id, { status: newStatus })
  }

  const handleSaveObs = () => {
    onUpdate(lead.id, { observacao: obs })
    setEditing(false)
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{lead.clienteNome}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{lead.clienteTelefone || '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{lead.clienteEmail || '-'}</td>
      <td className="px-4 py-3">
        <select
          value={lead.status}
          onChange={e => handleStatusChange(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {editing ? (
          <div className="flex gap-1">
            <input
              type="text"
              value={obs}
              onChange={e => setObs(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveObs()}
            />
            <button onClick={handleSaveObs} className="text-xs text-blue-600 hover:text-blue-800">OK</button>
          </div>
        ) : (
          <span
            className="cursor-pointer hover:text-blue-600"
            onClick={() => setEditing(true)}
            title="Clique para editar"
          >
            {lead.observacao || '-'}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(lead.criadoEm).toLocaleDateString('pt-BR')}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onDelete(lead.id)}
          className="text-xs text-red-500 hover:text-red-700"
          title="Remover lead"
        >
          Remover
        </button>
      </td>
    </tr>
  )
}

export default function ProspeccaoPage() {
  const queryClient = useQueryClient()
  const { data: leads = [], isLoading: loadingLeads } = useProspeccao()
  const { data: vendedores = [] } = useProspeccaoVendedores()
  const [statusFilter, setStatusFilter] = useState('all')
  const [vendedorFilter, setVendedorFilter] = useState('all')

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/prospeccao', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prospeccao'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => api.put(`/prospeccao/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prospeccao'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/prospeccao/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prospeccao'] }),
  })

  const vendedorMap = useMemo(() => {
    const map = {}
    vendedores.forEach(v => { map[v.id] = v })
    return map
  }, [vendedores])

  // Group leads by vendedor
  const grouped = useMemo(() => {
    const groups = {}
    vendedores.forEach(v => {
      groups[v.id] = { vendedor: v, leads: [] }
    })
    leads.forEach(l => {
      if (groups[l.vendedorId]) {
        groups[l.vendedorId].leads.push(l)
      }
    })
    return groups
  }, [leads, vendedores])

  // Stats
  const stats = useMemo(() => {
    const total = leads.length
    const pendentes = leads.filter(l => l.status === 'pendente').length
    const contatados = leads.filter(l => l.status === 'contatado').length
    const prospectados = leads.filter(l => l.status === 'prospectado').length
    const semInteresse = leads.filter(l => l.status === 'sem_interesse').length
    return { total, pendentes, contatados, prospectados, semInteresse }
  }, [leads])

  // Filter
  const filteredGroups = useMemo(() => {
    const result = {}
    Object.entries(grouped).forEach(([vid, group]) => {
      if (vendedorFilter !== 'all' && vid !== vendedorFilter) return
      const filteredLeads = statusFilter === 'all'
        ? group.leads
        : group.leads.filter(l => l.status === statusFilter)
      if (filteredLeads.length > 0 || vendedorFilter === vid || vendedorFilter === 'all') {
        result[vid] = { ...group, leads: filteredLeads }
      }
    })
    return result
  }, [grouped, statusFilter, vendedorFilter])

  const handleAdd = (data) => addMutation.mutate(data)
  const handleUpdate = (id, updates) => updateMutation.mutate({ id, updates })
  const handleDelete = (id) => {
    if (confirm('Remover este lead?')) deleteMutation.mutate(id)
  }

  if (loadingLeads) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Prospeccao de Clientes</h2>
          <p className="text-sm text-gray-500">Gerenciamento de leads por vendedor</p>
        </div>
        <RefreshButton queryKeys={['prospeccao']} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total Leads</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-yellow-200 p-3">
          <p className="text-xs text-yellow-600">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.pendentes}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-3">
          <p className="text-xs text-blue-600">Contatados</p>
          <p className="text-2xl font-bold text-blue-700">{stats.contatados}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-3">
          <p className="text-xs text-green-600">Prospectados</p>
          <p className="text-2xl font-bold text-green-700">{stats.prospectados}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Sem Interesse</p>
          <p className="text-2xl font-bold text-gray-500">{stats.semInteresse}</p>
        </div>
      </div>

      {/* Add Lead Form */}
      <AddLeadForm vendedores={vendedores} onAdd={handleAdd} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase">Vendedor:</span>
        <button
          onClick={() => setVendedorFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            vendedorFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos
        </button>
        {vendedores.map(v => (
          <button
            key={v.id}
            onClick={() => setVendedorFilter(v.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              vendedorFilter === v.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {v.nome}
          </button>
        ))}

        <span className="text-xs font-semibold text-gray-500 uppercase ml-4">Status:</span>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s.key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Vendedor Cards */}
      {Object.entries(filteredGroups).map(([vid, group]) => (
        <div key={vid} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-900">{group.vendedor.nome}</span>
              {group.vendedor.equipe && (
                <span className="ml-2 text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                  {group.vendedor.equipe}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {group.leads.length} lead{group.leads.length !== 1 ? 's' : ''}
            </span>
          </div>

          {group.leads.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Nenhum lead cadastrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Telefone</th>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Observacao</th>
                    <th className="px-4 py-2 font-medium">Data</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {group.leads.map(lead => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      vendedor={group.vendedor}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
