const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const sankhyaService = require('./sankhyaService');
const dashboardRoutes = require('./dashboardRoutes'); // ← NOVO

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Serve static dashboard ────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Dashboard route (serve HTML at root) ─────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;

// Middleware de log
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── API ROUTES ───────────────────────────────────────────────

/**
 * POST /api/produto
 */
app.post('/api/produto', async (req, res) => {
  const { termo } = req.body;
  if (!termo) {
    return res.status(400).json({ texto_resposta: "Informe o termo de busca." });
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
 * POST /api/financeiro
 */
app.post('/api/financeiro', async (req, res) => {
  const { cnpj_cpf } = req.body;
  if (!cnpj_cpf) return res.status(400).json({ texto_resposta: "CNPJ/CPF inválido." });
  try {
    const texto_resposta = await sankhyaService.getFinancialPending(cnpj_cpf);
    res.json({ texto_resposta });
  } catch (error) {
    console.error(error);
    res.status(500).json({ texto_resposta: "Erro interno ao consultar financeiro." });
  }
});

/**
 * POST /api/fiscal
 */
app.post('/api/fiscal', async (req, res) => {
  const { numero_nota } = req.body;
  if (!numero_nota) return res.status(400).json({ texto_resposta: "Número da nota não informado." });
  try {
    const headerRes = await sankhyaService.getOrderFiscalInfo(numero_nota);
    if (!headerRes.success) return res.json({ texto_resposta: `Erro: ${headerRes.message}` });
    const header = headerRes.data;

    const partnerName = await sankhyaService.getPartnerName(header.codparc);
    const itemsRes = await sankhyaService.getOrderItems(header.nunota);
    const items = itemsRes.success ? itemsRes.data.items : [];
    const codProds = items.map(i => i.codprod);
    const productMap = await sankhyaService.getProductDescriptions(codProds);

    let responseText = `📄 *NOTA FISCAL ${header.numnota}*\n`
      + `📅 Emissão: ${header.dtneg}\n`
      + `📦 Status: ${header.statusText}\n`
      + `👤 Cliente: ${partnerName}\n`
      + `💰 Total Nota: R$ ${header.vlrnota}\n\n*ITENS:* \n`;

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
 * POST /api/preco
 */
app.post('/api/preco', async (req, res) => {
  const { codigo, tabela } = req.body;
  if (!codigo) return res.status(400).json({ texto_resposta: "Código do produto não informado." });
  try {
    const nutab = tabela || 6;
    const resolved = await sankhyaService.findProduct(codigo);
    if (!resolved) return res.status(404).json({ texto_resposta: `Produto "${codigo}" não encontrado.` });
    const { codprod, descricao } = resolved;
    const price = await sankhyaService.getProductPriceREST(codprod, nutab);
    res.json({ texto_resposta: `💰 *${descricao}*\nTabela: ${nutab}\nValor: R$ ${price}`, price_raw: price, codprod_solved: codprod });
  } catch (error) {
    console.error(error);
    res.status(500).json({ texto_resposta: "Erro interno ao consultar preço." });
  }
});

// ─── DASHBOARD ROUTES ─────────────────────────────────────────
app.use('/api/dashboard', dashboardRoutes);

// ─── START ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}/`);
  console.log(`📡 API Base: ${process.env.SANKHYA_BASE_URL}`);
});
