const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'data', 'importacoes.json');

function ensureDir() {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function readAll() {
    ensureDir();
    if (!fs.existsSync(STORE_PATH)) return [];
    try {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function writeAll(entries) {
    ensureDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getAll() {
    return readAll().filter(e => e.status !== 'cancelado');
}

function getAllIncludingCancelled() {
    return readAll();
}

function getEmTransito() {
    return readAll().filter(e => e.status === 'em_transito');
}

function add(entry) {
    const entries = readAll();
    const newEntry = {
        id: generateId(),
        codprod: String(entry.codprod),
        descrprod: entry.descrprod || '',
        referencia: entry.referencia || '',
        quantidade: Number(entry.quantidade) || 0,
        dataCompra: entry.dataCompra || new Date().toISOString().slice(0, 10),
        previsaoChegada: entry.previsaoChegada || '',
        numeroPedido: entry.numeroPedido || '',
        fornecedor: entry.fornecedor || '',
        observacao: entry.observacao || '',
        status: 'em_transito',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
    };
    entries.push(newEntry);
    writeAll(entries);
    return newEntry;
}

function update(id, updates) {
    const entries = readAll();
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const allowed = ['quantidade', 'dataCompra', 'previsaoChegada', 'numeroPedido', 'fornecedor', 'observacao', 'status'];
    allowed.forEach(key => {
        if (updates[key] !== undefined) {
            entries[idx][key] = key === 'quantidade' ? Number(updates[key]) : updates[key];
        }
    });
    entries[idx].atualizadoEm = new Date().toISOString();
    writeAll(entries);
    return entries[idx];
}

function remove(id) {
    const entries = readAll();
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    entries[idx].status = 'cancelado';
    entries[idx].atualizadoEm = new Date().toISOString();
    writeAll(entries);
    return true;
}

function marcarRecebido(id, qtdRecebida) {
    const entries = readAll();
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return null;

    const entry = entries[idx];
    const recebido = Number(qtdRecebida) || entry.quantidade;
    const prevRecebido = entry.qtdRecebida || 0;
    const totalRecebido = prevRecebido + recebido;
    const restante = entry.quantidade - totalRecebido;

    entry.qtdRecebida = totalRecebido;
    entry.atualizadoEm = new Date().toISOString();

    if (restante <= 0) {
        entry.status = 'recebido';
        entry.qtdRecebida = entry.quantidade;
    } else {
        // Partial: keep em_transito, update quantity remaining
        entry.status = 'em_transito';
    }

    writeAll(entries);
    return entry;
}

/**
 * Returns a map of codprod -> total quantity in transit (em_transito only).
 * Used to adjust stock duration calculations.
 */
function getTransitMap() {
    const emTransito = getEmTransito();
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
