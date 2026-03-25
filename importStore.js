const supabase = require('./supabaseClient');

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function rowToEntry(row) {
    return {
        id: row.id,
        codprod: row.codprod,
        descrprod: row.descrprod,
        referencia: row.referencia,
        quantidade: row.quantidade,
        qtdRecebida: row.qtd_recebida,
        dataCompra: row.data_compra,
        previsaoChegada: row.previsao_chegada,
        numeroPedido: row.numero_pedido,
        fornecedor: row.fornecedor,
        observacao: row.observacao,
        status: row.status,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
    };
}

async function getAll() {
    const { data, error } = await supabase
        .from('importacoes')
        .select('*')
        .neq('status', 'cancelado')
        .order('criado_em', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToEntry);
}

async function getAllIncludingCancelled() {
    const { data, error } = await supabase
        .from('importacoes')
        .select('*')
        .order('criado_em', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(rowToEntry);
}

async function getEmTransito() {
    const { data, error } = await supabase
        .from('importacoes')
        .select('*')
        .eq('status', 'em_transito');
    if (error) throw new Error(error.message);
    return (data || []).map(rowToEntry);
}

async function add(entry) {
    const row = {
        id: generateId(),
        codprod: String(entry.codprod),
        descrprod: entry.descrprod || '',
        referencia: entry.referencia || '',
        quantidade: Number(entry.quantidade) || 0,
        qtd_recebida: 0,
        data_compra: entry.dataCompra || new Date().toISOString().slice(0, 10),
        previsao_chegada: entry.previsaoChegada || null,
        numero_pedido: entry.numeroPedido || '',
        fornecedor: entry.fornecedor || '',
        observacao: entry.observacao || '',
        status: 'em_transito',
    };
    const { data, error } = await supabase
        .from('importacoes')
        .insert(row)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return rowToEntry(data);
}

async function update(id, updates) {
    const dbUpdates = { atualizado_em: new Date().toISOString() };
    const fieldMap = {
        quantidade: 'quantidade',
        dataCompra: 'data_compra',
        previsaoChegada: 'previsao_chegada',
        numeroPedido: 'numero_pedido',
        fornecedor: 'fornecedor',
        observacao: 'observacao',
        status: 'status',
    };
    Object.entries(fieldMap).forEach(([camel, snake]) => {
        if (updates[camel] !== undefined) {
            dbUpdates[snake] = camel === 'quantidade' ? Number(updates[camel]) : updates[camel];
        }
    });
    const { data, error } = await supabase
        .from('importacoes')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return rowToEntry(data);
}

async function remove(id) {
    const { data, error } = await supabase
        .from('importacoes')
        .update({ status: 'cancelado', atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return !!data;
}

async function marcarRecebido(id, qtdRecebida) {
    // First get current entry
    const { data: current, error: fetchErr } = await supabase
        .from('importacoes')
        .select('*')
        .eq('id', id)
        .single();
    if (fetchErr || !current) return null;

    const recebido = Number(qtdRecebida) || current.quantidade;
    const prevRecebido = current.qtd_recebida || 0;
    const totalRecebido = prevRecebido + recebido;
    const restante = current.quantidade - totalRecebido;

    const upd = {
        qtd_recebida: restante <= 0 ? current.quantidade : totalRecebido,
        status: restante <= 0 ? 'recebido' : 'em_transito',
        atualizado_em: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('importacoes')
        .update(upd)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return rowToEntry(data);
}

async function getTransitMap() {
    const emTransito = await getEmTransito();
    const map = {};
    emTransito.forEach(e => {
        const restante = e.quantidade - (e.qtdRecebida || 0);
        if (restante > 0) {
            map[e.codprod] = (map[e.codprod] || 0) + restante;
        }
    });
    return map;
}

module.exports = { getAll, getAllIncludingCancelled, getEmTransito, add, update, remove, marcarRecebido, getTransitMap };
