const supabase = require('./supabaseClient');

const VENDEDORES = [
    { id: 'mara', nome: 'Mara', equipe: 'Estrategia' },
    { id: 'fernanda', nome: 'Fernanda', equipe: 'FP' },
    { id: 'mazza', nome: 'Mazza', equipe: '' },
    { id: 'daniela', nome: 'Daniela', equipe: 'Atitude' },
    { id: 'pablo', nome: 'Pablo', equipe: '' },
    { id: 'adriano', nome: 'Adriano', equipe: '' },
    { id: 'andre', nome: 'Andre', equipe: 'Norte' },
];

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getVendedores() {
    return VENDEDORES;
}

async function getAll() {
    const { data, error } = await supabase
        .from('prospeccao')
        .select('*')
        .order('criado_em', { ascending: false });
    if (error) throw new Error(error.message);
    // Map snake_case DB columns to camelCase for frontend compatibility
    return (data || []).map(row => ({
        id: row.id,
        vendedorId: row.vendedor_id,
        clienteNome: row.cliente_nome,
        cidadeEstado: row.cidade_estado,
        clienteTelefone: row.cliente_telefone,
        clienteEmail: row.cliente_email,
        observacao: row.observacao,
        status: row.status,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
    }));
}

async function add(entry) {
    const row = {
        id: generateId(),
        vendedor_id: entry.vendedorId,
        cliente_nome: entry.clienteNome || '',
        cidade_estado: entry.cidadeEstado || '',
        cliente_telefone: entry.clienteTelefone || '',
        cliente_email: entry.clienteEmail || '',
        observacao: entry.observacao || '',
        status: 'pendente',
    };
    const { data, error } = await supabase
        .from('prospeccao')
        .insert(row)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return {
        id: data.id,
        vendedorId: data.vendedor_id,
        clienteNome: data.cliente_nome,
        cidadeEstado: data.cidade_estado,
        clienteTelefone: data.cliente_telefone,
        clienteEmail: data.cliente_email,
        observacao: data.observacao,
        status: data.status,
        criadoEm: data.criado_em,
        atualizadoEm: data.atualizado_em,
    };
}

async function update(id, updates) {
    const dbUpdates = { atualizado_em: new Date().toISOString() };
    const fieldMap = {
        vendedorId: 'vendedor_id',
        clienteNome: 'cliente_nome',
        cidadeEstado: 'cidade_estado',
        clienteTelefone: 'cliente_telefone',
        clienteEmail: 'cliente_email',
        observacao: 'observacao',
        status: 'status',
    };
    Object.entries(fieldMap).forEach(([camel, snake]) => {
        if (updates[camel] !== undefined) {
            dbUpdates[snake] = updates[camel];
        }
    });
    const { data, error } = await supabase
        .from('prospeccao')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
        id: data.id,
        vendedorId: data.vendedor_id,
        clienteNome: data.cliente_nome,
        cidadeEstado: data.cidade_estado,
        clienteTelefone: data.cliente_telefone,
        clienteEmail: data.cliente_email,
        observacao: data.observacao,
        status: data.status,
        criadoEm: data.criado_em,
        atualizadoEm: data.atualizado_em,
    };
}

async function remove(id) {
    const { error } = await supabase
        .from('prospeccao')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
    return true;
}

module.exports = { getAll, getVendedores, add, update, remove };
