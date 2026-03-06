const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const sankhyaService = require('./sankhyaService');
const cache = require('./cache');

dotenv.config();

const app = express();

// CORS - allow Vite dev server and production
app.use(cors());

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

const CACHE_30M = 30 * 60 * 1000;
const CACHE_15M = 15 * 60 * 1000;

// Helper: build Sankhya date string dd/MM/yyyy
function toSankhyaDate(dateStr) {
    // Accepts yyyy-MM-dd or dd/MM/yyyy
    if (dateStr.includes('-')) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }
    return dateStr;
}

// Helper: get date N months ago as dd/MM/yyyy
function monthsAgo(n) {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    const dd = String(d.getDate()).padStart(2, '0');
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
        cache.set(cacheKey, result, CACHE_30M);
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
        const codprods = (req.query.codprods || '').split(',').filter(Boolean);
        if (codprods.length === 0) {
            return res.status(400).json({ error: 'Parâmetro codprods obrigatório.' });
        }
        const stockMap = await sankhyaService.getBulkStock(codprods);
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
            cache.set(cacheKey, result, CACHE_15M);
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
        cache.set(cacheKey, result, CACHE_15M);
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
        const stockMap = await sankhyaService.getBulkStock(productsWithSales);

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
        cache.set(cacheKey, result, CACHE_15M);
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
            .filter(v => !/^sem\s+vendedor$/i.test(v.nome))
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
        cache.set(cacheKey, result, CACHE_15M);
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

        // If no cache yet, return loading status (warm-up is running in background)
        return res.json({ asx: [], absolux: [], totalAsx: 0, totalAbsolux: 0, loading: true });

        /* The code below is kept as fallback but warm-up handles the heavy work */
        const t0 = Date.now();
        const endDate = todaySankhya();
        const start6m = monthsAgo(6);
        const start3m = monthsAgo(3);

        // 1. Fetch 6m invoices (single call, contains 3m data too)
        const invoices6m = await sankhyaService.getSalesInvoices(start6m, endDate);
        console.log(`[Compras] ${invoices6m.length} invoices in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

        if (invoices6m.length === 0) {
            const result = { items: [], total: 0 };
            cache.set(cacheKey, result, CACHE_30M);
            return res.json(result);
        }

        // 2. Get items ONCE
        const t1 = Date.now();
        const nunotas = invoices6m.map(inv => inv.nunota);
        const allItems = await sankhyaService.getSalesItemsByNunotas(nunotas);
        console.log(`[Compras] ${allItems.length} items in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

        // 3. Map invoice dates
        const invoiceDateMap = {};
        invoices6m.forEach(inv => { invoiceDateMap[inv.nunota] = inv.dtneg; });

        function parseSankhyaDate(str) {
            if (!str) return null;
            const [d, m, y] = str.split('/').map(Number);
            return new Date(y, m - 1, d);
        }
        const cutoff3m = parseSankhyaDate(start3m);

        // 4. Aggregate qty per product: 3m and 6m
        const qty3m = {}, qty6m = {};
        allItems.forEach(item => {
            const cod = String(item.codprod);
            qty6m[cod] = (qty6m[cod] || 0) + item.qtdneg;
            const invDate = parseSankhyaDate(invoiceDateMap[item.nunota]);
            if (invDate && invDate >= cutoff3m) {
                qty3m[cod] = (qty3m[cod] || 0) + item.qtdneg;
            }
        });

        // 5. Get stock for products with sales via CRUD
        const t2 = Date.now();
        const soldCods = Object.keys(qty6m);
        console.log(`[Compras] Fetching stock for ${soldCods.length} products...`);
        const stockMap = await sankhyaService.getBulkStockCRUD(soldCods);
        console.log(`[Compras] Stock in ${((Date.now() - t2) / 1000).toFixed(1)}s`);

        // 6. Get product descriptions + group info for sold products
        const t3 = Date.now();
        const productMap = await sankhyaService.getProductDescriptionsFull(soldCods);
        console.log(`[Compras] Descriptions in ${((Date.now() - t3) / 1000).toFixed(1)}s`);

        // 7. Build result - ALL products with sales, split by group prefix
        // ASX = CODGRUPOPROD starts with 9901, ABSOLUX = starts with 9902
        const asx = [];
        const absolux = [];

        soldCods.forEach(cod => {
            const prod = productMap[cod] || {};
            const grupo = String(prod.codgrupoprod || '');

            const isAsx = grupo.startsWith('9901');
            const isAbsolux = grupo.startsWith('9902');
            if (!isAsx && !isAbsolux) return;

            const stock = stockMap.get(cod) || 0;
            const avg6m = Math.round(((qty6m[cod] || 0) / 6) * 100) / 100;

            // Duracao: quantos meses o estoque atual dura baseado na media 6m
            const duracao = avg6m > 0 ? Math.round((stock / avg6m) * 100) / 100 : null;

            // Comprar para abastecer 3m e 6m
            const need3m = avg6m > 0 ? Math.max(0, Math.ceil(avg6m * 3 - stock)) : 0;
            const need6m = avg6m > 0 ? Math.max(0, Math.ceil(avg6m * 6 - stock)) : 0;

            let status;
            if (duracao === null) status = 'sem_media';
            else if (duracao < 1) status = 'critico';
            else if (duracao < 3) status = 'atencao';
            else if (duracao < 6) status = 'repor';
            else status = 'ok';

            const item = {
                codprod: cod,
                descrprod: prod.descrprod || `Produto ${cod}`,
                referencia: prod.referencia || '',
                marca: prod.marca || '',
                stock,
                avg6m,
                need3m,
                need6m,
                duracao,
                status,
            };

            if (isAsx) asx.push(item);
            if (isAbsolux) absolux.push(item);
        });

        // Sort: critico > atencao > repor > ok > sem_media
        const statusOrder = { critico: 0, atencao: 1, repor: 2, ok: 3, sem_media: 4 };
        const sortFn = (a, b) => statusOrder[a.status] - statusOrder[b.status] || (a.duracao ?? 999) - (b.duracao ?? 999);
        asx.sort(sortFn);
        absolux.sort(sortFn);

        const totalTime = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`[Compras] DONE in ${totalTime}s - ASX: ${asx.length}, ABSOLUX: ${absolux.length}`);

        const result = { asx, absolux, totalAsx: asx.length, totalAbsolux: absolux.length };
        cache.set(cacheKey, result, CACHE_30M);
        res.json(result);
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
        cache.set(cacheKey, result, CACHE_15M);
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
        if (!codparc) return res.json([]);
        const codprods = await sankhyaService.getProductCodesByPartner(codparc);
        res.json(codprods);
    } catch (error) {
        console.error('Products by partner error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar produtos do parceiro.' });
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
async function warmUpPurchaseManagement() {
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
            cache.set('purchase_management', { asx: [], absolux: [], totalAsx: 0, totalAbsolux: 0 }, CACHE_30M);
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

        console.log('[WarmUp] Step 3/4: Fetching stock...');
        const t2 = Date.now();
        const soldCods = Object.keys(qty6m);
        const stockMap = await sankhyaService.getBulkStockCRUD(soldCods);
        console.log(`[WarmUp] Stock for ${soldCods.length} products in ${((Date.now() - t2) / 1000).toFixed(1)}s`);

        console.log('[WarmUp] Step 4/5: Fetching descriptions...');
        const t3 = Date.now();
        const productMap = await sankhyaService.getProductDescriptionsFull(soldCods);
        console.log(`[WarmUp] Descriptions in ${((Date.now() - t3) / 1000).toFixed(1)}s`);

        // Step 5: Fetch supplier names
        console.log('[WarmUp] Step 5/5: Fetching supplier names...');
        const t4 = Date.now();
        const uniqueParcs = [...new Set(Object.values(productMap).map(p => p.codparcforn).filter(c => c && c !== '0'))];
        const partnerMap = await sankhyaService.getPartnerNamesBulk(uniqueParcs);
        console.log(`[WarmUp] Supplier names for ${uniqueParcs.length} partners in ${((Date.now() - t4) / 1000).toFixed(1)}s`);

        const asx = [];
        const absolux = [];

        soldCods.forEach(cod => {
            const prod = productMap[cod] || {};
            const grupo = String(prod.codgrupoprod || '');

            const isAsx = grupo.startsWith('9901');
            const isAbsolux = grupo.startsWith('9902');
            if (!isAsx && !isAbsolux) return;

            const stock = stockMap.get(cod) || 0;
            const avg6m = Math.round(((qty6m[cod] || 0) / 6) * 100) / 100;
            const duracao = avg6m > 0 ? Math.round((stock / avg6m) * 100) / 100 : null;
            const need3m = avg6m > 0 ? Math.max(0, Math.ceil(avg6m * 3 - stock)) : 0;
            const need6m = avg6m > 0 ? Math.max(0, Math.ceil(avg6m * 6 - stock)) : 0;

            let status;
            if (duracao === null) status = 'sem_media';
            else if (duracao < 1) status = 'critico';
            else if (duracao < 3) status = 'atencao';
            else if (duracao < 6) status = 'repor';
            else status = 'ok';

            const codparcforn = prod.codparcforn || '0';
            const nomeforn = partnerMap[codparcforn] || '';

            const item = { codprod: cod, descrprod: prod.descrprod || `Produto ${cod}`, referencia: prod.referencia || '', marca: prod.marca || '', stock, avg6m, need3m, need6m, duracao, status, codparcforn, nomeforn };
            if (isAsx) asx.push(item);
            if (isAbsolux) absolux.push(item);
        });

        const statusOrder = { critico: 0, atencao: 1, repor: 2, ok: 3, sem_media: 4 };
        const sortFn = (a, b) => statusOrder[a.status] - statusOrder[b.status] || (a.duracao ?? 999) - (b.duracao ?? 999);
        asx.sort(sortFn);
        absolux.sort(sortFn);

        const result = { asx, absolux, totalAsx: asx.length, totalAbsolux: absolux.length };
        cache.set('purchase_management', result, 24 * 60 * 60 * 1000); // 24h - renovado pelo scheduler

        const totalTime = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`[WarmUp] COMPLETE in ${totalTime}s - ASX: ${asx.length}, ABSOLUX: ${absolux.length}`);
    } catch (error) {
        console.error('[WarmUp] Error:', error.message);
    }
}

// Schedule warm-up at fixed times: 08:30, 13:30, 16:30
function scheduleWarmUp() {
    const SCHEDULE = [
        { hour: 8, minute: 30 },
        { hour: 13, minute: 30 },
        { hour: 16, minute: 30 },
    ];

    function scheduleNext() {
        const now = new Date();
        let next = null;

        for (const s of SCHEDULE) {
            const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s.hour, s.minute, 0);
            if (candidate > now) {
                if (!next || candidate < next) next = candidate;
            }
        }

        // If no more today, schedule first one tomorrow
        if (!next) {
            const first = SCHEDULE.reduce((a, b) => a.hour < b.hour || (a.hour === b.hour && a.minute < b.minute) ? a : b);
            next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, first.hour, first.minute, 0);
        }

        const delay = next.getTime() - now.getTime();
        const timeStr = next.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        console.log(`[Scheduler] Proxima atualizacao de compras: ${timeStr} (em ${Math.round(delay / 60000)} min)`);

        setTimeout(() => {
            console.log(`[Scheduler] Iniciando atualizacao agendada (${new Date().toLocaleTimeString('pt-BR')})`);
            warmUpPurchaseManagement().then(() => scheduleNext());
        }, delay);
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

// Start Server
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Endpoint Sankhya: ${process.env.SANKHYA_BASE_URL}`);
    console.log('--- Server Ready (v2.0 - Dashboard) ---');

    scheduleWarmUp();
});
