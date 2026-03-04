const express = require('express');
const router = express.Router();
const dashboardService = require('./dashboardService');

// Cache simples em memória para evitar sobrecarga na API
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function getCache(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache[key] = { data, ts: Date.now() };
}

/**
 * GET /api/dashboard/summary
 * KPIs principais + vendas 6 meses + vendas por vendedor
 */
router.get('/summary', async (req, res) => {
  const cached = getCache('summary');
  if (cached && !req.query.refresh) return res.json(cached);

  try {
    const data = await dashboardService.getDashboardData();
    setCache('summary', data);
    res.json(data);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do dashboard', detail: error.message });
  }
});

/**
 * GET /api/dashboard/estoque
 * Estoque atual por produto (excluindo garantia/uso/descarte)
 */
router.get('/estoque', async (req, res) => {
  const cached = getCache('estoque');
  if (cached && !req.query.refresh) return res.json(cached);

  try {
    const stockMap = await dashboardService.getStockByProduct();
    const data = { stockByProduct: stockMap, total: Object.values(stockMap).reduce((s, v) => s + v, 0) };
    setCache('estoque', data);
    res.json(data);
  } catch (error) {
    console.error('Estoque error:', error);
    res.status(500).json({ error: 'Erro ao buscar estoque', detail: error.message });
  }
});

/**
 * GET /api/dashboard/compras
 * Indicações de compra (mais pesado - pode demorar)
 */
router.get('/compras', async (req, res) => {
  const cached = getCache('compras');
  if (cached && !req.query.refresh) return res.json(cached);

  try {
    const recommendations = await dashboardService.getPurchaseRecommendations();
    const data = { recommendations, generatedAt: new Date().toISOString() };
    setCache('compras', data);
    res.json(data);
  } catch (error) {
    console.error('Compras error:', error);
    res.status(500).json({ error: 'Erro ao calcular indicações de compra', detail: error.message });
  }
});

/**
 * DELETE /api/dashboard/cache
 * Limpa o cache
 */
router.delete('/cache', (req, res) => {
  Object.keys(cache).forEach(k => delete cache[k]);
  res.json({ message: 'Cache limpo com sucesso' });
});

module.exports = router;
