const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const sankhyaService = require('./sankhyaService');
const cache = require('./cache');
const importStore = require('./importStore');

// Optional security packages (graceful degradation if not installed)
let helmet, rateLimit;
try { helmet = require('helmet'); } catch (e) { console.warn('[Security] helmet not installed, skipping security headers'); }
try { rateLimit = require('express-rate-limit'); } catch (e) { console.warn('[Security] express-rate-limit not installed, skipping rate limiting'); }

dotenv.config();

const app = express();

// Security headers (if helmet available)
if (helmet) {
    app.use(helmet({
        contentSecurityPolicy: false, // disabled for SPA
        crossOriginEmbedderPolicy: false,
    }));
}

// CORS - restrict to known origins
const ALLOWED_ORIGINS = [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Production/self
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null,
    process.env.FRONTEND_URL, // Custom frontend URL
].filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (same-origin, server-to-server, curl, etc.)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else if (origin && origin.endsWith('.up.railway.app')) {
            // Allow all Railway subdomains
            callback(null, true);
        } else {
            console.warn(`[CORS] Unknown origin: ${origin}`);
            callback(null, true); // permissive for now, log for monitoring
        }
    },
    credentials: true,
}));

// Rate limiting (if express-rate-limit available)
if (rateLimit) {
    const apiLimiter = rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 120, // 120 requests per minute per IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Muitas requisicoes, tente novamente em instantes.' },
    });
    app.use('/api/', apiLimiter);
}

// API Key authentication (optional - set DASHBOARD_API_KEY in .env to enable)
const API_KEY = process.env.DASHBOARD_API_KEY;
if (API_KEY) {
    app.use('/api/', (req, res, next) => {
        const key = req.headers['x-api-key'] || req.query.apikey;
        if (key !== API_KEY) {
            return res.status(401).json({ error: 'API key invalida ou ausente.' });
        }
        next();
    });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Middleware to log requests and set long timeout for dashboard routes
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.path.startsWith('/api/dashboard/')) {
        req.setTimeout(10 * 60 * 1000); // 10 minutes
        res.setTimeout(10 * 60 * 1000);
    }
    next();
});

// --- Existing Chatbot Routes ---

app.post('/api/produto', async (req, res) => {
    const { termo } = req.body;
    if (!termo) {
        return res.status(400).json({
            texto_resposta: "Por favor, informe o termo de busca (CD ou Nome).",
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

app.post('/api/fiscal', async (req, res) => {
    const { numero_nota } = req.body;
    if (!numero_nota) {
        return res.status(400).json({ texto_resposta: "Número da nota não informado." });
    }
    try {
        const headerRes = await sankhyaService.getOrderFiscalInfo(numero_nota);
        if (!headerRes.success) {
            return res.json({ texto_resposta: `Erro: ${headerRes.message}` });
        }
        const header = headerRes.data;
        const partnerName = await sankhyaService.getPartnerName(header.codparc);
        const itemsRes = await sankhyaService.getOrderItems(header.nunota);
        const items = itemsRes.success ? itemsRes.data.items : [];
        const codProds = items.map(i => i.codprod);
        const productMap = await sankhyaService.getProductDescriptions(codProds);

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

app.post('/api/preco', async (req, res) => {
    const { codigo, tabela } = req.body;
    if (!codigo) {
        return res.status(400).json({ texto_resposta: "Código do produto não informado." });
    }
    try {
        const nutab = tabela || 6;
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

// --- Dashboard API Routes ---

const CACHE_5M = 5 * 60 * 1000;
const CACHE_10M = 10 * 60 * 1000;

// Helper: build Sankhya date string dd/MM/yyyy
function toSankhyaDate(dateStr) {
    // Accepts yyyy-MM-dd or dd/MM/yyyy
    if (dateStr.includes('-')) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }
    return dateStr;
}

// Helper: get date N months ago as dd/MM/yyyy (safe for month boundaries)
function monthsAgo(n) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - n, 1); // first day of target month
    // Use original day, but clamp to last day of target month
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const day = Math.min(now.getDate(), lastDay);
    const dd = String(day).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// Helper: today as dd/MM/yyyy
function todaySankhya() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * GET /api/dashboard/products
 * Returns ALL active products (fetches all pages from Sankhya).
 */
app.get('/api/dashboard/products', async (req, res) => {
    try {
        const cacheKey = 'products_all';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const products = await sankhyaService.getAllActiveProductsFull();
        const result = { products, count: products.length };
        cache.set(cacheKey, result, CACHE_10M);
        res.json(result);
    } catch (error) {
        console.error('Dashboard products error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar produtos.' });
    }
});

/**
 * GET /api/dashboard/stock?codprods=1,2,3
 */
app.get('/api/dashboard/stock', async (req, res) => {
    try {
        const codprods = (req.query.codprods || '').split(',').filter(Boolean).filter(v => /^\d+$/.test(v));
        if (codprods.length === 0) {
            return res.status(400).json({ error: 'Parâmetro codprods obrigatório (valores numericos).' });
        }
        const stockMap = await sankhyaService.getBulkStockCRUD(codprods);
        const stock = {};
        stockMap.forEach((val, key) => { stock[key] = val; });
        res.json({ stock });
    } catch (error) {
        console.error('Dashboard stock error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar estoque.' });
    }
});

/**
 * GET /api/dashboard/sales-summary?months=6
 * Returns average qty sold per product over N months.
 */
app.get('/api/dashboard/sales-summary', async (req, res) => {
    try {
        const months = parseInt(req.query.months) || 6;
        const cacheKey = `sales_summary_${months}m`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const startDate = monthsAgo(months);
        const endDate = todaySankhya();

        const invoices = await sankhyaService.getSalesInvoices(startDate, endDate);
        if (invoices.length === 0) {
            const result = { averages: {}, months, totalInvoices: 0 };
            cache.set(cacheKey, result, CACHE_5M);
            return res.json(result);
        }

        const nunotas = invoices.map(inv => inv.nunota);
        const items = await sankhyaService.getSalesItemsByNunotas(nunotas);

        // Aggregate qty per product
        const qtyByProduct = {};
        items.forEach(item => {
            const cod = String(item.codprod);
            qtyByProduct[cod] = (qtyByProduct[cod] || 0) + item.qtdneg;
        });

        // Calculate monthly average
        const averages = {};
        Object.entries(qtyByProduct).forEach(([cod, totalQty]) => {
            averages[cod] = Math.round((totalQty / months) * 100) / 100;
        });

        const result = { averages, months, totalInvoices: invoices.length };
        cache.set(cacheKey, result, CACHE_5M);
        res.json(result);
    } catch (error) {
        console.error('Dashboard sales-summary error:', error.message);
        res.status(500).json({ error: 'Erro ao calcular resumo de vendas.' });
    }
});

/**
 * GET /api/dashboard/purchase-suggestions
 * Orchestrates products + stock + sales average to suggest purchases.
 */
app.get('/api/dashboard/purchase-suggestions', async (req, res) => {
    try {
        const cacheKey = 'purchase_suggestions';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        // 1. Get all active products + sales data in parallel
        const months = 6;
        const startDate = monthsAgo(months);
        const endDate = todaySankhya();

        const [products, invoices] = await Promise.all([
            sankhyaService.getAllActiveProductsFull(),
            sankhyaService.getSalesInvoices(startDate, endDate),
        ]);

        // 2. Calculate sales averages
        let salesSummaryRes = {};
        if (invoices.length > 0) {
            const nunotas = invoices.map(inv => inv.nunota);
            const items = await sankhyaService.getSalesItemsByNunotas(nunotas);
            const qtyByProduct = {};
            items.forEach(item => {
                const cod = String(item.codprod);
                qtyByProduct[cod] = (qtyByProduct[cod] || 0) + item.qtdneg;
            });
            Object.entries(qtyByProduct).forEach(([cod, totalQty]) => {
                salesSummaryRes[cod] = Math.round((totalQty / months) * 100) / 100;
            });
        }

        // 3. Only fetch stock for products that had sales (optimization: ~1500 instead of ~6900)
        const productsWithSales = Object.keys(salesSummaryRes);
        console.log(`Fetching stock for ${productsWithSales.length} products with sales...`);
        const stockMap = await sankhyaService.getBulkStockCRUD(productsWithSales);

        // 3. Build suggestions
        const suggestions = products.map(p => {
            const cod = String(p.codprod);
            const stock = stockMap.get(cod) || 0;
            const avgMonth = salesSummaryRes[cod] || 0;
            const coverageMonths = avgMonth > 0 ? Math.round((stock / avgMonth) * 100) / 100 : (stock > 0 ? 999 : 0);

            let status;
            if (avgMonth === 0 && stock === 0) status = 'sem_giro';
            else if (coverageMonths < 1) status = 'critico';
            else if (coverageMonths < 3) status = 'atencao';
            else status = 'ok';

            return {
                codprod: p.codprod,
                descrprod: p.descrprod,
                referencia: p.referencia,
                marca: p.marca,
                stock,
                avgMonth,
                coverageMonths: coverageMonths === 999 ? null : coverageMonths,
                status,
            };
        });

        const result = { suggestions, total: suggestions.length };
        cache.set(cacheKey, result, CACHE_5M);
        res.json(result);
    } catch (error) {
        console.error('Dashboard purchase-suggestions error:', error.message);
        res.status(500).json({ error: 'Erro ao calcular sugestões de compra.' });
    }
});

/**
 * GET /api/dashboard/sales-data?startDate=2024-01-01&endDate=2024-06-30
 * Unified endpoint: fetches invoices ONCE and returns both period totals and vendor breakdown.
 * This avoids concurrent Sankhya API calls which cause empty responses.
 */
app.get('/api/dashboard/sales-data', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate e endDate obrigatórios.' });
        }
        // Validate date format (yyyy-MM-dd or dd/MM/yyyy)
        const dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({ error: 'Formato de data invalido. Use yyyy-MM-dd ou dd/MM/yyyy.' });
        }

        const start = toSankhyaDate(startDate);
        const end = toSankhyaDate(endDate);
        const cacheKey = `sales_data_${start}_${end}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        // Single call for invoices, then vendor list
        console.log(`[sales-data] Fetching invoices from ${start} to ${end}...`);
        const invoices = await sankhyaService.getSalesInvoices(start, end);
        console.log(`[sales-data] Got ${invoices.length} invoices`);
        const vendors = await sankhyaService.getVendorList();

        // Period totals
        const totalValue = invoices.reduce((sum, inv) => sum + inv.vlrnota, 0);

        // Vendor breakdown
        const vendorMap = {};
        vendors.forEach(v => { vendorMap[String(v.codvend)] = v.apelido; });

        // Vendor breakdown with monthly detail
        const byVendor = {};
        invoices.forEach(inv => {
            const cod = String(inv.codvend);
            if (!byVendor[cod]) {
                byVendor[cod] = { codvend: cod, nome: vendorMap[cod] || `Vendedor ${cod}`, totalValue: 0, totalInvoices: 0, monthly: {} };
            }
            byVendor[cod].totalValue += inv.vlrnota;
            byVendor[cod].totalInvoices += 1;

            // Monthly breakdown: key = "YYYY-MM"
            if (inv.dtneg) {
                let monthKey;
                if (inv.dtneg.includes('/')) {
                    // dd/MM/yyyy
                    const parts = inv.dtneg.split('/');
                    monthKey = `${parts[2]}-${parts[1]}`;
                } else {
                    monthKey = inv.dtneg.substring(0, 7);
                }
                if (!byVendor[cod].monthly[monthKey]) {
                    byVendor[cod].monthly[monthKey] = { value: 0, invoices: 0 };
                }
                byVendor[cod].monthly[monthKey].value += inv.vlrnota;
                byVendor[cod].monthly[monthKey].invoices += 1;
            }
        });

        const ASX_VENDORS = ['VISAC', 'TIAGO LEAL', 'REP ATITUDE', 'QUEILA', 'J OLIVEIRA', 'ASX COMER', 'MARA ELAIN', 'MARA ELIANE', 'FB PROMOTO', 'F B PROMOTO'];

        const allVendorSales = Object.values(byVendor)
            .filter(v => !/sem\s*vendedor/i.test(v.nome))
            .map(v => ({
                ...v,
                totalValue: Math.round(v.totalValue * 100) / 100,
                monthly: Object.fromEntries(
                    Object.entries(v.monthly).map(([k, m]) => [k, { value: Math.round(m.value * 100) / 100, invoices: m.invoices }])
                ),
            }))
            .sort((a, b) => b.totalValue - a.totalValue);

        const vendorSalesAsx = allVendorSales.filter(v =>
            ASX_VENDORS.some(name => v.nome.toUpperCase().includes(name))
        );
        const vendorSalesAbsolux = allVendorSales.filter(v =>
            !ASX_VENDORS.some(name => v.nome.toUpperCase().includes(name))
        );
        const vendorSales = allVendorSales;

        // Collect all months in the period for column headers
        const allMonths = [...new Set(invoices.map(inv => {
            if (!inv.dtneg) return null;
            if (inv.dtneg.includes('/')) {
                const parts = inv.dtneg.split('/');
                return `${parts[2]}-${parts[1]}`;
            }
            return inv.dtneg.substring(0, 7);
        }).filter(Boolean))].sort();

        // Top 10 buyers (clients) with vendor info
        const byClient = {};
        invoices.forEach(inv => {
            const cod = String(inv.codparc);
            if (cod === '0') return;
            if (!byClient[cod]) {
                byClient[cod] = { codparc: cod, nome: inv.nomeparc || `Cliente ${cod}`, totalValue: 0, totalInvoices: 0, vendors: {} };
            }
            byClient[cod].totalValue += inv.vlrnota;
            byClient[cod].totalInvoices += 1;
            // Track vendor for this client
            const vendCod = String(inv.codvend);
            const vendNome = vendorMap[vendCod] || '';
            if (vendCod !== '0' && vendNome) {
                if (!byClient[cod].vendors[vendCod]) {
                    byClient[cod].vendors[vendCod] = { nome: vendNome, value: 0 };
                }
                byClient[cod].vendors[vendCod].value += inv.vlrnota;
            }
        });
        const topBuyers = Object.values(byClient)
            .filter(c => !/\bASX\b/i.test(c.nome)) // exclude internal transfers (ASX itself)
            .map(c => {
                // Pick the vendor with most sales for this client
                const vendorEntries = Object.values(c.vendors);
                const topVendor = vendorEntries.length > 0
                    ? vendorEntries.sort((a, b) => b.value - a.value)[0].nome
                    : '-';
                return {
                    codparc: c.codparc,
                    nome: c.nome,
                    totalValue: Math.round(c.totalValue * 100) / 100,
                    totalInvoices: c.totalInvoices,
                    vendedor: topVendor,
                };
            })
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 10);

        const result = {
            totalValue: Math.round(totalValue * 100) / 100,
            totalInvoices: invoices.length,
            vendorSales,
            vendorSalesAsx,
            vendorSalesAbsolux,
            topBuyers,
            months: allMonths,
            startDate: start,
            endDate: end,
        };
        cache.set(cacheKey, result, CACHE_5M);
        res.json(result);
    } catch (error) {
        console.error('Dashboard sales-data error:', error.message, error.stack);
        res.status(500).json({ error: 'Erro ao buscar dados de vendas.', detail: error.message });
    }
});

/**
 * GET /api/dashboard/purchase-management
 * Returns resale products with sales averages (1m, 3m, 6m) and purchase needs.
 * Excludes: uso/consumo and imobilizado products.
 */
app.get('/api/dashboard/purchase-management', async (req, res) => {
    try {
        const cacheKey = 'purchase_management';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        // No cache yet - return loading status (warm-up runs in background)
        return res.json({ asx: [], absolux: [], totalAsx: 0, totalAbsolux: 0, loading: true });
    } catch (error) {
        console.error('Dashboard purchase-management error:', error.message);
        res.status(500).json({ error: 'Erro ao calcular gestao de compras.' });
    }
});

/**
 * GET /api/dashboard/top-products-asx
 * Returns top 10 most sold and top 10 least sold ASX products with stock.
 * Uses direct SQL for fast response (no warm-up dependency).
 */
app.get('/api/dashboard/top-products-asx', async (req, res) => {
    try {
        const cacheKey = 'top_products_asx';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        const data = await sankhyaService.getTopProductsASX();
        const result = { loading: false, ...data };
        cache.set(cacheKey, result, CACHE_5M);
        res.json(result);
    } catch (error) {
        console.error('Dashboard top-products-asx error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar top produtos.' });
    }
});

/**
 * GET /api/dashboard/search-partners?term=xxx
 * Search partners (parceiros) by name, razao social or code for autocomplete.
 */
app.get('/api/dashboard/search-partners', async (req, res) => {
    try {
        const { term } = req.query;
        if (!term || term.length < 2) return res.json([]);
        const results = await sankhyaService.searchPartners(term);
        res.json(results);
    } catch (error) {
        console.error('Search partners error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar parceiros.' });
    }
});

/**
 * GET /api/dashboard/products-by-partner?codparc=xxx
 * Returns product codes (CODPROD) linked to a partner via purchase invoices.
 */
app.get('/api/dashboard/products-by-partner', async (req, res) => {
    try {
        const { codparc } = req.query;
        if (!codparc || !/^\d+$/.test(codparc)) return res.json([]);
        const codprods = await sankhyaService.getProductCodesByPartner(codparc);
        res.json(codprods);
    } catch (error) {
        console.error('Products by partner error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar produtos do parceiro.' });
    }
});

// --- Faturamento Pendente Routes ---

/**
 * GET /api/dashboard/pending-billing
 * Returns pending sales orders (pedidos de venda) not yet billed.
 * Uses TIPMOV='P', STATUSNOTA='A', specific TOPs for ASX/ABSOLUX sales.
 */
app.get('/api/dashboard/pending-billing', async (req, res) => {
    try {
        const cacheKey = 'pending_billing';
        const cached = cache.get(cacheKey);
        if (cached) return res.json(cached);

        // Portal de Vendas: Tipo de Operacao = Pedidos de Venda (TIPMOV='P')
        // VLRNOTA = valor total do pedido conforme exibido no Portal de Vendas
        // STATUSNOTA='A' = pedidos pendentes (abertos, aguardando faturamento)
        const sql = `SELECT CAB.NUNOTA, CAB.NUMNOTA, TO_CHAR(CAB.DTNEG, 'DD/MM/YYYY') AS DTNEG,
            CAB.CODTIPOPER, CAB.CODPARC, PAR.NOMEPARC,
            NVL(CAB.VLRNOTA, 0) AS VLRNOTA,
            CAB.CODVEND, VEN.APELIDO AS NOMEVEND, CAB.STATUSNOTA
            FROM TGFCAB CAB
            LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
            LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
            WHERE CAB.TIPMOV = 'P' AND CAB.STATUSNOTA = 'A'
            AND CAB.DTNEG >= TRUNC(SYSDATE, 'MM')
            ORDER BY VLRNOTA DESC`;

        const result = await sankhyaService.executeSQL(sql);
        const rows = (result.rows || []).map(row => ({
            nunota: String(row[0]),
            numnota: String(row[1] || '0'),
            dtneg: row[2] || '',
            codtipoper: String(row[3]),
            codparc: String(row[4]),
            nomeparc: row[5] || '',
            vlrnota: parseFloat(row[6] || 0),
            codvend: String(row[7] || '0'),
            nomevend: row[8] || '',
            statusnota: row[9] || '',
        }));

        const totalValue = rows.reduce((sum, r) => sum + r.vlrnota, 0);
        const data = { orders: rows, totalOrders: rows.length, totalValue };
        cache.set(cacheKey, data, 5 * 60 * 1000); // 5 min cache
        res.json(data);
    } catch (error) {
        console.error('Pending billing error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar faturamento pendente.' });
    }
});

// --- Importacao (Transit) Routes ---

/**
 * GET /api/dashboard/importacoes
 * Returns all import entries (excluding cancelled).
 */
app.get('/api/dashboard/importacoes', (req, res) => {
    try {
        const entries = importStore.getAll();
        res.json(entries);
    } catch (error) {
        console.error('Importacoes GET error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar importacoes.' });
    }
});

/**
 * POST /api/dashboard/importacoes
 * Add a new import entry (product in transit).
 */
app.post('/api/dashboard/importacoes', (req, res) => {
    try {
        const { codprod, quantidade } = req.body;
        if (!codprod || !quantidade || quantidade <= 0) {
            return res.status(400).json({ error: 'codprod e quantidade (>0) sao obrigatorios.' });
        }
        const entry = importStore.add(req.body);
        // Invalidate purchase_management cache so transit data is recalculated
        cache.invalidate('purchase_management');
        res.status(201).json(entry);
    } catch (error) {
        console.error('Importacoes POST error:', error.message);
        res.status(500).json({ error: 'Erro ao adicionar importacao.' });
    }
});

/**
 * PUT /api/dashboard/importacoes/:id
 * Update an import entry.
 */
app.put('/api/dashboard/importacoes/:id', (req, res) => {
    try {
        const updated = importStore.update(req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Importacao nao encontrada.' });
        cache.invalidate('purchase_management');
        res.json(updated);
    } catch (error) {
        console.error('Importacoes PUT error:', error.message);
        res.status(500).json({ error: 'Erro ao atualizar importacao.' });
    }
});

/**
 * PUT /api/dashboard/importacoes/:id/recebido
 * Mark an import as received (supports partial quantity).
 * Body: { qtdRecebida: number } (optional - defaults to full quantity)
 */
app.put('/api/dashboard/importacoes/:id/recebido', (req, res) => {
    try {
        const qtdRecebida = req.body?.qtdRecebida;
        const updated = importStore.marcarRecebido(req.params.id, qtdRecebida);
        if (!updated) return res.status(404).json({ error: 'Importacao nao encontrada.' });
        cache.invalidate('purchase_management');
        res.json(updated);
    } catch (error) {
        console.error('Importacoes recebido error:', error.message);
        res.status(500).json({ error: 'Erro ao marcar recebido.' });
    }
});

/**
 * DELETE /api/dashboard/importacoes/:id
 * Cancel an import entry (soft delete).
 */
app.delete('/api/dashboard/importacoes/:id', (req, res) => {
    try {
        const removed = importStore.remove(req.params.id);
        if (!removed) return res.status(404).json({ error: 'Importacao nao encontrada.' });
        cache.invalidate('purchase_management');
        res.json({ ok: true });
    } catch (error) {
        console.error('Importacoes DELETE error:', error.message);
        res.status(500).json({ error: 'Erro ao cancelar importacao.' });
    }
});

/**
 * GET /api/dashboard/search-products-asx?term=xxx
 * Search ASX products by code, name or reference for the import form autocomplete.
 */
app.get('/api/dashboard/search-products-asx', async (req, res) => {
    try {
        const { term } = req.query;
        if (!term || term.length < 2) return res.json([]);

        // Use cached purchase_management data if available, otherwise query Sankhya
        const cached = cache.get('purchase_management');
        if (cached && cached.asx) {
            const termLower = term.toLowerCase();
            const results = cached.asx
                .filter(p =>
                    String(p.codprod).includes(term) ||
                    (p.descrprod && p.descrprod.toLowerCase().includes(termLower)) ||
                    (p.referencia && p.referencia.toLowerCase().includes(termLower))
                )
                .slice(0, 20)
                .map(p => ({ codprod: p.codprod, descrprod: p.descrprod, referencia: p.referencia }));
            return res.json(results);
        }

        // Fallback: fetch all active ASX products and filter in-memory
        const allProducts = await sankhyaService.getAllActiveResaleProducts();
        const termLower = term.toLowerCase();
        const results = allProducts
            .filter(p => {
                const grupo = String(p.codgrupoprod || '');
                const ref = (p.referencia || '').toUpperCase();
                return grupo.startsWith('9901') || grupo.startsWith('70') || ref.startsWith('ASX');
            })
            .filter(p =>
                String(p.codprod).includes(term) ||
                (p.descrprod && p.descrprod.toLowerCase().includes(termLower)) ||
                (p.referencia && p.referencia.toLowerCase().includes(termLower))
            )
            .slice(0, 20)
            .map(p => ({ codprod: String(p.codprod), descrprod: p.descrprod || '', referencia: p.referencia || '' }));
        res.json(results);
    } catch (error) {
        console.error('Search products ASX error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar produtos ASX.' });
    }
});

// --- Static Frontend Serving ---
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// SPA Fallback - any non-API route serves index.html
app.get('{*path}', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Rota não encontrada.' });
    }
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// Warm-up: pre-load heavy endpoints in background on startup
let _warmUpRunning = false;
async function warmUpPurchaseManagement() {
    if (_warmUpRunning) {
        console.log('[WarmUp] Already running, skipping duplicate call.');
        return;
    }
    _warmUpRunning = true;
    console.log('[WarmUp] Starting purchase-management pre-load in background...');
    try {
        const t0 = Date.now();
        const endDate = todaySankhya();
        const start6m = monthsAgo(6);
        const start3m = monthsAgo(3);

        console.log('[WarmUp] Step 1/4: Fetching 6m invoices...');
        const invoices6m = await sankhyaService.getSalesInvoices(start6m, endDate);
        console.log(`[WarmUp] ${invoices6m.length} invoices in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

        if (invoices6m.length === 0) {
            cache.set('purchase_management', { asx: [], absolux: [], totalAsx: 0, totalAbsolux: 0 }, CACHE_10M);
            console.log('[WarmUp] No invoices found, cached empty result.');
            return;
        }

        console.log('[WarmUp] Step 2/4: Fetching items...');
        const t1 = Date.now();
        const nunotas = invoices6m.map(inv => inv.nunota);
        const allItems = await sankhyaService.getSalesItemsByNunotas(nunotas);
        console.log(`[WarmUp] ${allItems.length} items in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

        const invoiceDateMap = {};
        invoices6m.forEach(inv => { invoiceDateMap[inv.nunota] = inv.dtneg; });

        function parseSankhyaDate(str) {
            if (!str) return null;
            const [d, m, y] = str.split('/').map(Number);
            return new Date(y, m - 1, d);
        }
        const cutoff3m = parseSankhyaDate(start3m);

        const qty3m = {}, qty6m = {};
        allItems.forEach(item => {
            const cod = String(item.codprod);
            qty6m[cod] = (qty6m[cod] || 0) + item.qtdneg;
            const invDate = parseSankhyaDate(invoiceDateMap[item.nunota]);
            if (invDate && invDate >= cutoff3m) {
                qty3m[cod] = (qty3m[cod] || 0) + item.qtdneg;
            }
        });

        console.log('[WarmUp] Step 3-4: Fetching stock + descriptions in parallel...');
        const t2 = Date.now();
        const soldCods = Object.keys(qty6m);
        const [stockMap, productMap] = await Promise.all([
            sankhyaService.getBulkStockCRUD(soldCods),
            sankhyaService.getProductDescriptionsFull(soldCods),
        ]);
        console.log(`[WarmUp] Stock + Descriptions for ${soldCods.length} products in ${((Date.now() - t2) / 1000).toFixed(1)}s`);

        // Step 5: Fetch supplier names
        // Step 5: Fetch ALL active ASX/ABSOLUX products (including those without sales)
        console.log('[WarmUp] Step 5/6: Fetching all active resale products...');
        const t4 = Date.now();
        const allResaleProducts = await sankhyaService.getAllActiveResaleProducts();
        console.log(`[WarmUp] ${allResaleProducts.length} active resale products in ${((Date.now() - t4) / 1000).toFixed(1)}s`);

        // Step 6: Fetch supplier names
        console.log('[WarmUp] Step 6/6: Fetching supplier names...');
        const t5 = Date.now();
        // Collect supplier codes from both sold products and all resale products
        const allParcCodes = new Set();
        Object.values(productMap).forEach(p => { if (p.codparcforn && p.codparcforn !== '0') allParcCodes.add(p.codparcforn); });
        allResaleProducts.forEach(p => { if (p.codparcforn && p.codparcforn !== '0') allParcCodes.add(p.codparcforn); });
        const partnerMap = await sankhyaService.getPartnerNamesBulk([...allParcCodes]);
        console.log(`[WarmUp] Supplier names for ${allParcCodes.size} partners in ${((Date.now() - t5) / 1000).toFixed(1)}s`);

        // Load transit quantities from importacoes
        const transitMap = importStore.getTransitMap();
        console.log(`[WarmUp] Transit items: ${Object.keys(transitMap).length} products with ${Object.values(transitMap).reduce((a, b) => a + b, 0)} units in transit`);

        const asx = [];
        const absolux = [];
        const includedCods = new Set();

        // ASX = groups 9901* or 70* (resale products), ABSOLUX = 9902*
        function classifyGroup(grupo, referencia) {
            if (grupo.startsWith('9902')) return 'absolux';
            if (grupo.startsWith('9901') || grupo.startsWith('70')) return 'asx';
            // Fallback: products with ASX reference are ASX products
            if (referencia && referencia.toUpperCase().startsWith('ASX')) return 'asx';
            return null;
        }

        // Exclude: palhetas, supplier refs like H760W, and specific discontinued products
        const REFFORN_EXCLUDE = /^H\d+/i;
        const REFFORN_BLACKLIST = new Set(['LT72BI', 'BC12V', 'LTLAM85', 'T1008AM', 'SIRBIV', 'CABORCA', 'ASX8440']);
        function shouldExcludeFromAsx(descrprod, refforn) {
            if (descrprod && descrprod.toUpperCase().includes('PALHETA')) return true;
            if (refforn && REFFORN_EXCLUDE.test(refforn.trim())) return true;
            if (refforn && REFFORN_BLACKLIST.has(refforn.trim())) return true;
            return false;
        }

        // First: add products that had sales (with full metrics)
        soldCods.forEach(cod => {
            const prod = productMap[cod] || {};
            const grupo = String(prod.codgrupoprod || '');

            const classification = classifyGroup(grupo, prod.referencia);
            const isAsx = classification === 'asx';
            const isAbsolux = classification === 'absolux';
            if (!isAsx && !isAbsolux) return;
            if (isAsx && shouldExcludeFromAsx(prod.descrprod, prod.refforn)) return;

            includedCods.add(cod);
            const stock = stockMap.get(cod) || 0;
            const emTransito = transitMap[cod] || 0;
            const stockEfetivo = stock + emTransito;
            const avg6m = Math.round(((qty6m[cod] || 0) / 6) * 100) / 100;
            const duracao = avg6m > 0 ? Math.round((stockEfetivo / avg6m) * 100) / 100 : null;
            const need3m = avg6m > 0 ? Math.max(0, Math.ceil(avg6m * 3 - stockEfetivo)) : 0;
            const need6m = avg6m > 0 ? Math.max(0, Math.ceil(avg6m * 6 - stockEfetivo)) : 0;

            let status;
            if (duracao === null) status = 'sem_media';
            else if (duracao < 1) status = 'critico';
            else if (duracao < 3) status = 'atencao';
            else if (duracao < 6) status = 'repor';
            else status = 'ok';

            const codparcforn = prod.codparcforn || '0';
            const nomeforn = partnerMap[codparcforn] || '';

            const item = { codprod: cod, descrprod: prod.descrprod || `Produto ${cod}`, referencia: prod.referencia || '', marca: prod.marca || '', refforn: prod.refforn || '', stock, emTransito, avg6m, need3m, need6m, duracao, status, codparcforn, nomeforn };
            if (isAsx) asx.push(item);
            if (isAbsolux) absolux.push(item);
        });

        // Second: add active products WITHOUT sales (sem_giro) - these were missing before
        allResaleProducts.forEach(prod => {
            const cod = prod.codprod;
            if (includedCods.has(cod)) return; // already included from sales

            const classification = classifyGroup(prod.codgrupoprod, prod.referencia);
            const isAsx = classification === 'asx';
            const isAbsolux = classification === 'absolux';
            if (!isAsx && !isAbsolux) return;
            if (isAsx && shouldExcludeFromAsx(prod.descrprod, prod.refforn)) return;

            const nomeforn = partnerMap[prod.codparcforn] || '';

            const emTransito = transitMap[cod] || 0;
            const item = {
                codprod: cod,
                descrprod: prod.descrprod,
                referencia: prod.referencia,
                marca: prod.marca,
                refforn: prod.refforn,
                stock: prod.stock,
                emTransito,
                avg6m: 0,
                need3m: 0,
                need6m: 0,
                duracao: null,
                status: (prod.stock + emTransito) > 0 ? 'sem_media' : 'critico',
                codparcforn: prod.codparcforn,
                nomeforn,
            };

            // Skip dead products: stock 0, no transit, no sales - completely inactive
            if (prod.stock === 0 && emTransito === 0) return;

            if (isAsx) asx.push(item);
            if (isAbsolux) absolux.push(item);
        });

        const statusOrder = { critico: 0, sem_giro: 1, atencao: 2, repor: 3, ok: 4, sem_media: 5 };
        const sortFn = (a, b) => statusOrder[a.status] - statusOrder[b.status] || (a.duracao ?? 999) - (b.duracao ?? 999);
        asx.sort(sortFn);
        absolux.sort(sortFn);

        const result = { asx, absolux, totalAsx: asx.length, totalAbsolux: absolux.length };
        cache.set('purchase_management', result, 24 * 60 * 60 * 1000); // 24h - renovado pelo scheduler

        const totalTime = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`[WarmUp] COMPLETE in ${totalTime}s - ASX: ${asx.length}, ABSOLUX: ${absolux.length}`);
    } catch (error) {
        console.error('[WarmUp] Error:', error.message);
    } finally {
        _warmUpRunning = false;
    }
}

// Schedule warm-up every 3 hours (more frequent than old 3x/day)
function scheduleWarmUp() {
    const INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

    function scheduleNext() {
        const nextTime = new Date(Date.now() + INTERVAL_MS);
        const timeStr = nextTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        console.log(`[Scheduler] Proxima atualizacao de compras: ${timeStr} (em ${Math.round(INTERVAL_MS / 60000)} min)`);

        setTimeout(() => {
            console.log(`[Scheduler] Iniciando atualizacao agendada (${new Date().toLocaleTimeString('pt-BR')})`);
            warmUpPurchaseManagement().then(() => scheduleNext());
        }, INTERVAL_MS);
    }

    // Run immediately on startup if no cache exists, then schedule
    const cached = cache.get('purchase_management');
    if (!cached) {
        console.log('[Scheduler] Sem cache, executando primeira carga...');
        warmUpPurchaseManagement().then(() => scheduleNext());
    } else {
        scheduleNext();
    }
}

// Force warm-up refresh (manual trigger)
app.get('/api/dashboard/refresh', async (req, res) => {
    console.log('[Refresh] Manual warm-up triggered');
    res.json({ status: 'refreshing', message: 'Warm-up iniciado em background' });
    warmUpPurchaseManagement().catch(err => console.error('[Refresh] Warm-up error:', err.message));
});

// Invalidate specific cache keys (for manual refresh from frontend)
app.post('/api/dashboard/invalidate-cache', (req, res) => {
    const { keys } = req.body;
    if (!keys || !Array.isArray(keys)) {
        return res.status(400).json({ error: 'Envie { keys: ["key1", "key2"] }' });
    }
    const allowed = ['products_all', 'sales_summary', 'purchase_suggestions', 'sales_data', 'top_products_asx', 'pending_billing', 'purchase_management'];
    let invalidated = 0;
    keys.forEach(key => {
        // Allow prefix matching (e.g., "sales_data" invalidates "sales_data_01/01/2025_31/01/2025")
        if (allowed.some(a => key.startsWith(a))) {
            cache.invalidate(key);
            invalidated++;
        }
    });
    // Also clear any cache entries that start with provided keys
    if (cache.store) {
        for (const cacheKey of cache.store.keys()) {
            if (keys.some(k => cacheKey.startsWith(k))) {
                cache.invalidate(cacheKey);
                invalidated++;
            }
        }
    }
    console.log(`[Cache] Invalidated ${invalidated} entries for keys: ${keys.join(', ')}`);
    res.json({ ok: true, invalidated });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Endpoint Sankhya: ${process.env.SANKHYA_BASE_URL}`);
    console.log('--- Server Ready (v2.0 - Dashboard) ---');

    scheduleWarmUp();
});
