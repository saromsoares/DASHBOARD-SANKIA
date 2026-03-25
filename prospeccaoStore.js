const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'data', 'prospeccao.json');

const VENDEDORES = [
    { id: 'mara', nome: 'Mara', equipe: 'Estrategia' },
    { id: 'fernanda', nome: 'Fernanda', equipe: 'FP' },
    { id: 'mazza', nome: 'Mazza', equipe: '' },
    { id: 'daniela', nome: 'Daniela', equipe: 'Atitude' },
    { id: 'pablo', nome: 'Pablo', equipe: '' },
    { id: 'adriano', nome: 'Adriano', equipe: '' },
    { id: 'andre', nome: 'Andre', equipe: 'Norte' },
];

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
    return readAll();
}

function getVendedores() {
    return VENDEDORES;
}

function add(entry) {
    const entries = readAll();
    const newEntry = {
        id: generateId(),
        vendedorId: entry.vendedorId,
        clienteNome: entry.clienteNome || '',
        clienteTelefone: entry.clienteTelefone || '',
        clienteEmail: entry.clienteEmail || '',
        observacao: entry.observacao || '',
        status: 'pendente',
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
    const allowed = ['clienteNome', 'clienteTelefone', 'clienteEmail', 'observacao', 'status', 'vendedorId'];
    allowed.forEach(key => {
        if (updates[key] !== undefined) {
            entries[idx][key] = updates[key];
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
    entries.splice(idx, 1);
    writeAll(entries);
    return true;
}

module.exports = { getAll, getVendedores, add, update, remove };
