const express = require('express');
const dotenv = require('dotenv');
const sankhyaService = require('./sankhyaService');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Support form-data/urlencoded

const PORT = process.env.PORT || 3000;

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    // Log headers to debug Content-Type issues
    console.log('Headers:', JSON.stringify(req.headers));
    next();
});

// --- Routes ---

/**
 * Rota /api/produto
 * Recebe: { "termo": "..." }
 */
app.post('/api/produto', async (req, res) => {
    console.log('Body received:', req.body); // DEBUG BODY
    const { termo } = req.body;
    if (!termo) {
        console.error('Error: "termo" is missing in body.');
        return res.status(400).json({
            texto_resposta: "Por favor, informe o termo de busca (CD ou Nome).",
            debug_received: req.body // Return what we received to help user debug
        });
    }

    try {
        const texto_resposta = await sankhyaService.getProductInfo(termo);
        res.json({ texto_resposta });
    } catch (error) {
        console.error(error);
        res.status(500).json({ texto_resposta: "Erro interno ao consultar produto." });
    }
});

/**
 * Rota /api/financeiro
 * Recebe: { "cnpj_cpf": "..." }
 */
app.post('/api/financeiro', async (req, res) => {
    const { cnpj_cpf } = req.body;
    if (!cnpj_cpf) {
        return res.status(400).json({ texto_resposta: "CNPJ/CPF inválido." });
    }

    try {
        const texto_resposta = await sankhyaService.getFinancialPending(cnpj_cpf);
        res.json({ texto_resposta });
    } catch (error) {
        console.error(error);
        res.status(500).json({ texto_resposta: "Erro interno ao consultar financeiro." });
    }
});

/**
 * Rota /api/fiscal
 * Recebe: { "numero_nota": "..." }
 */
app.post('/api/fiscal', async (req, res) => {
    const { numero_nota } = req.body;
    if (!numero_nota) {
        return res.status(400).json({ texto_resposta: "Número da nota não informado." });
    }

    try {
        // 1. Get Header (Fiscal Info)
        const headerRes = await sankhyaService.getOrderFiscalInfo(numero_nota);
        if (!headerRes.success) {
            return res.json({ texto_resposta: `Erro: ${headerRes.message}` });
        }
        const header = headerRes.data;

        // 2. Get Partner Name
        const partnerName = await sankhyaService.getPartnerName(header.codparc);

        // 3. Get Items
        const itemsRes = await sankhyaService.getOrderItems(header.nunota);
        const items = itemsRes.success ? itemsRes.data.items : [];

        // 4. Resolve Product Names
        const codProds = items.map(i => i.codprod);
        const productMap = await sankhyaService.getProductDescriptions(codProds);

        // 5. Format Response Text for Chatbot
        let responseText = `📄 *NOTA FISCAL ${header.numnota}*\n` +
            `📅 Emissão: ${header.dtneg}\n` +
            `📦 Status: ${header.statusText}\n` +
            `👤 Cliente: ${partnerName}\n` +
            `💰 Total Nota: R$ ${header.vlrnota}\n\n` +
            `*ITENS:* \n`;

        items.forEach((item, idx) => {
            const desc = productMap[item.codprod] || `Prod ${item.codprod}`;
            responseText += `${idx + 1}. ${desc} (x${item.quantidade}) - R$ ${item.valorTotal}\n`;
        });

        if (items.length === 0) responseText += "Nenhum item encontrado.";

        res.json({ texto_resposta: responseText });

    } catch (error) {
        console.error(error);
        res.status(500).json({ texto_resposta: "Erro interno ao processar nota fiscal." });
    }
});

/**
 * Rota /api/preco
 * Recebe: { "codigo": "397", "tabela": 6 }
 * Se tabela não informada, usa padrão (0 ou 6 conforme lógica).
 */
app.post('/api/preco', async (req, res) => {
    const { codigo, tabela } = req.body;

    if (!codigo) {
        return res.status(400).json({ texto_resposta: "Código do produto não informado." });
    }

    try {
        // Default to Table 6 if not provided, or strict check? 
        // Let's pass whatever is received. default logic is in service.
        const nutab = tabela || 6;

        // NEW: Resolve Product Code vs Reference
        const resolved = await sankhyaService.findProduct(codigo);

        if (!resolved) {
            return res.status(404).json({ texto_resposta: `Produto não encontrado para o código/referência "${codigo}".` });
        }

        const { codprod, descricao } = resolved;
        const price = await sankhyaService.getProductPriceREST(codprod, nutab);

        const texto_resposta = `💰 *${descricao}*\nValor: R$ ${price}`;
        res.json({ texto_resposta, price_raw: price, codprod_solved: codprod });

    } catch (error) {
        console.error(error);
        res.status(500).json({ texto_resposta: "Erro interno ao consultar preço." });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Endpoint Sankhya: ${process.env.SANKHYA_BASE_URL}`);
    console.log('--- Server Ready (v1.1) ---');
});
