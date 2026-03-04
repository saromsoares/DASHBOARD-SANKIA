const sankhyaService = require('./sankhyaService');

// ─── LOCAIS A EXCLUIR DO ESTOQUE ────────────────────────────────────────────
// Confirmado nas telas: GARANTIA DESCARTE (9901007), SEPARADO FISCO (9901003)
// USO E CONSUMO (código a ser descoberto via query)
// DCQ - GERAL (9901006) FICA ✅
const EXCLUDED_LOCAL_CODES_FALLBACK = [9901007, 9901003];
const EXCLUDED_WAREHOUSE_KEYWORDS = ['GARANTIA DESCARTE', 'SEPARADO FISCO', 'USO E CONSUMO'];

class DashboardService {

  _sankhyaDate(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${date.getFullYear()}`;
  }

  /**
   * Busca os códigos dos locais excluídos via API
   * Fallback: usa códigos fixos confirmados nas telas
   */
  async getExcludedWarehouseCodes() {
    const conditions = EXCLUDED_WAREHOUSE_KEYWORDS.map(w => `DESCRLOCAL LIKE '%${w}%'`).join(' OR ');

    for (const entity of ['LocalEstoque', 'Local', 'LocalArmazem']) {
      try {
        const body = {
          dataSet: {
            rootEntity: entity,
            includePresentationFields: "N",
            offsetPage: "0",
            criteria: { expression: { "$": conditions } },
            entity: { fieldset: { list: "CODLOCAL,DESCRLOCAL" } }
          }
        };
        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;
        if (entities) {
          const list = Array.isArray(entities) ? entities : [entities];
          const codes = list.map(l => l.f0?.['$'] || l.CODLOCAL?.['$'] || l.CODLOCAL).filter(Boolean);
          console.log(`🏭 Locais excluídos: ${list.map(l => l.f1?.['$'] || l.DESCRLOCAL?.['$']).join(' | ')}`);
          return codes;
        }
      } catch (e) {
        console.log(`⚠️  '${entity}' falhou, tentando próxima...`);
      }
    }

    console.log('⚠️  Usando fallback fixo: 9901007 (GARANTIA DESCARTE), 9901003 (SEPARADO FISCO)');
    return EXCLUDED_LOCAL_CODES_FALLBACK;
  }

  /**
   * Estoque total por produto excluindo locais especiais
   * Retorna: { CODPROD: { estoque: N, grupo: 'NOME GRUPO', descGrupo: 'X' } }
   */
  async getStockByProduct() {
    const excludedCodes = await this.getExcludedWarehouseCodes();
    const criteria = excludedCodes.length > 0
      ? `CODLOCAL NOT IN (${excludedCodes.join(',')})`
      : "1=1";

    const body = {
      dataSet: {
        rootEntity: "Estoque",
        includePresentationFields: "N",
        offsetPage: "0",
        criteria: { expression: { "$": criteria } },
        entity: { fieldset: { list: "CODPROD,CODLOCAL,ESTOQUE" } }
      }
    };

    const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
    const entities = response.responseBody?.entities?.entity;

    const map = {};
    if (entities) {
      const list = Array.isArray(entities) ? entities : [entities];
      list.forEach(item => {
        const cod = item.f0?.['$'] || item.CODPROD?.['$'] || item.CODPROD;
        const qty = parseFloat(item.f2?.['$'] || item.ESTOQUE?.['$'] || item.ESTOQUE || 0);
        if (cod) map[cod] = (map[cod] || 0) + qty;
      });
    }
    return map;
  }

  /**
   * Total de produtos ativos por grupo
   * Retorna: { total: N, byGroup: [{ grupo, descGrupo, total }] }
   */
  async getTotalProducts() {
    try {
      const body = {
        dataSet: {
          rootEntity: "Produto",
          includePresentationFields: "N",
          offsetPage: "0",
          criteria: { expression: "ATIVO = 'S'" },
          entity: { fieldset: { list: "CODPROD,CODGRUPOPROD" } }
        }
      };
      const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;
      if (!entities) return { total: 0, byGroup: [] };
      const list = Array.isArray(entities) ? entities : [entities];

      const groupCount = {};
      list.forEach(p => {
        const grp = p.f1?.['$'] || p.CODGRUPOPROD?.['$'] || p.CODGRUPOPROD || 'SEM GRUPO';
        groupCount[grp] = (groupCount[grp] || 0) + 1;
      });

      return { total: list.length, groupCount };
    } catch (e) {
      console.error('getTotalProducts error:', e.message);
      return { total: 0, groupCount: {} };
    }
  }

  /**
   * Busca nomes dos grupos de produto
   */
  async getGroupNames() {
    try {
      for (const entity of ['GrupoProduto', 'GrupoProd', 'Grupo']) {
        try {
          const body = {
            dataSet: {
              rootEntity: entity,
              includePresentationFields: "N",
              offsetPage: "0",
              criteria: { expression: "1=1" },
              entity: { fieldset: { list: "CODGRUPOPROD,DESCRGRUPOPROD" } }
            }
          };
          const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
          const entities = response.responseBody?.entities?.entity;
          if (entities) {
            const map = {};
            const list = Array.isArray(entities) ? entities : [entities];
            list.forEach(g => {
              const cod = g.f0?.['$'] || g.CODGRUPOPROD?.['$'] || g.CODGRUPOPROD;
              const nome = g.f1?.['$'] || g.DESCRGRUPOPROD?.['$'] || g.DESCRGRUPOPROD;
              if (cod) map[cod] = nome || cod;
            });
            console.log(`📦 [${entity}] ${Object.keys(map).length} grupos encontrados`);
            return map;
          }
        } catch (e) {
          console.log(`⚠️  Entidade '${entity}' falhou`);
        }
      }
      return {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Vendas do mês atual - total e por vendedor
   */
  async getCurrentMonthSales() {
    const now = new Date();
    const firstStr = this._sankhyaDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const todayStr = this._sankhyaDate(now);
    const criteria = `TIPMOV IN ('P','V','E') AND STATUSNOTA != 'C' AND DTNEG >= '${firstStr}' AND DTNEG <= '${todayStr}'`;

    try {
      const body = {
        dataSet: {
          rootEntity: "CabecalhoNota",
          includePresentationFields: "N",
          offsetPage: "0",
          criteria: { expression: { "$": criteria } },
          entity: { fieldset: { list: "NUNOTA,VLRNOTA,CODVEND" } }
        }
      };
      const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;

      let total = 0, count = 0;
      const byVendorCode = {};

      if (entities) {
        const list = Array.isArray(entities) ? entities : [entities];
        list.forEach(nota => {
          const vlr = parseFloat(nota.f1?.['$'] || nota.VLRNOTA?.['$'] || nota.VLRNOTA || 0);
          const cod = nota.f2?.['$'] || nota.CODVEND?.['$'] || nota.CODVEND;
          total += vlr; count++;
          if (cod) byVendorCode[cod] = (byVendorCode[cod] || 0) + vlr;
        });
      }
      return { total, count, byVendorCode };
    } catch (e) {
      console.error('getCurrentMonthSales error:', e.message);
      return { total: 0, count: 0, byVendorCode: {} };
    }
  }

  /**
   * Nomes dos vendedores
   */
  async getVendorNames() {
    for (const entity of ['Vendedor', 'VendedorOrcamento']) {
      try {
        const body = {
          dataSet: {
            rootEntity: entity,
            includePresentationFields: "N",
            offsetPage: "0",
            criteria: { expression: "1=1" },
            entity: { fieldset: { list: "CODVEND,NOMEVEND" } }
          }
        };
        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;
        if (entities) {
          const map = {};
          const list = Array.isArray(entities) ? entities : [entities];
          list.forEach(v => {
            const cod = v.f0?.['$'] || v.CODVEND?.['$'] || v.CODVEND;
            const nome = v.f1?.['$'] || v.NOMEVEND?.['$'] || v.NOMEVEND;
            if (cod) map[cod] = nome;
          });
          return map;
        }
      } catch (e) {}
    }
    return {};
  }

  /**
   * Vendas mensais dos últimos 6 meses (total + por grupo)
   */
  async getLast6MonthsSales() {
    const results = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const firstStr = this._sankhyaDate(d);
      const lastStr = this._sankhyaDate(lastDay);
      const label = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      const criteria = `TIPMOV IN ('P','V','E') AND STATUSNOTA != 'C' AND DTNEG >= '${firstStr}' AND DTNEG <= '${lastStr}'`;

      try {
        const body = {
          dataSet: {
            rootEntity: "CabecalhoNota",
            includePresentationFields: "N",
            offsetPage: "0",
            criteria: { expression: { "$": criteria } },
            entity: { fieldset: { list: "VLRNOTA" } }
          }
        };
        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;
        let monthTotal = 0;
        if (entities) {
          const list = Array.isArray(entities) ? entities : [entities];
          list.forEach(n => { monthTotal += parseFloat(n.f0?.['$'] || n.VLRNOTA?.['$'] || n.VLRNOTA || 0); });
        }
        results.push({ label, total: monthTotal, month: d.getMonth() + 1, year: d.getFullYear() });
      } catch (e) {
        results.push({ label, total: 0, month: d.getMonth() + 1, year: d.getFullYear() });
      }
    }
    return results;
  }

  /**
   * Vendas por produto nos últimos 6 meses (qtd vendida)
   * Inclui CODGRUPOPROD para agrupar na tabela de compras
   */
  async getLast6MonthsSalesByProduct() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const firstStr = this._sankhyaDate(sixMonthsAgo);
    const todayStr = this._sankhyaDate(now);

    const criteria = `this.NUNOTA IN (SELECT NUNOTA FROM TGFCAB WHERE TIPMOV IN ('P','V','E') AND STATUSNOTA != 'C' AND DTNEG >= '${firstStr}' AND DTNEG <= '${todayStr}')`;

    try {
      const body = {
        dataSet: {
          rootEntity: "ItemNota",
          includePresentationFields: "N",
          offsetPage: "0",
          criteria: { expression: { "$": criteria } },
          entity: { fieldset: { list: "CODPROD,QTDNEG" } }
        }
      };
      const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;

      const map = {};
      if (entities) {
        const list = Array.isArray(entities) ? entities : [entities];
        list.forEach(item => {
          const cod = item.f0?.['$'] || item.CODPROD?.['$'] || item.CODPROD;
          const qty = parseFloat(item.f1?.['$'] || item.QTDNEG?.['$'] || item.QTDNEG || 0);
          if (cod) map[cod] = (map[cod] || 0) + qty;
        });
      }
      return map;
    } catch (e) {
      console.error('getLast6MonthsSalesByProduct error:', e.message);
      return {};
    }
  }

  /**
   * Busca grupo de produto para uma lista de códigos
   * Retorna: { CODPROD: { codGrupo, descGrupo } }
   */
  async getProductGroups(codProdList) {
    if (!codProdList || codProdList.length === 0) return {};
    const inClause = [...new Set(codProdList)].join(',');

    try {
      const body = {
        dataSet: {
          rootEntity: "Produto",
          includePresentationFields: "N",
          offsetPage: "0",
          criteria: { expression: { "$": `CODPROD IN (${inClause})` } },
          entity: { fieldset: { list: "CODPROD,CODGRUPOPROD,AD_DESCRGRUPOPROD" } }
        }
      };
      const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;
      const map = {};
      if (entities) {
        const list = Array.isArray(entities) ? entities : [entities];
        list.forEach(p => {
          const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
          const codGrupo = p.f1?.['$'] || p.CODGRUPOPROD?.['$'] || p.CODGRUPOPROD || '';
          const descGrupo = p.f2?.['$'] || p.AD_DESCRGRUPOPROD?.['$'] || p.AD_DESCRGRUPOPROD || '';
          if (cod) map[cod] = { codGrupo, descGrupo };
        });
      }
      return map;
    } catch (e) {
      // Tenta sem AD_DESCRGRUPOPROD
      try {
        const body2 = {
          dataSet: {
            rootEntity: "Produto",
            includePresentationFields: "N",
            offsetPage: "0",
            criteria: { expression: { "$": `CODPROD IN (${inClause})` } },
            entity: { fieldset: { list: "CODPROD,CODGRUPOPROD" } }
          }
        };
        const response2 = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body2, 'mge');
        const entities2 = response2.responseBody?.entities?.entity;
        const map2 = {};
        if (entities2) {
          const list2 = Array.isArray(entities2) ? entities2 : [entities2];
          list2.forEach(p => {
            const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
            const codGrupo = p.f1?.['$'] || p.CODGRUPOPROD?.['$'] || p.CODGRUPOPROD || 'SEM GRUPO';
            if (cod) map2[cod] = { codGrupo, descGrupo: codGrupo };
          });
        }
        return map2;
      } catch (e2) {
        return {};
      }
    }
  }

  /**
   * Indicações de compra separadas por grupo
   */
  async getPurchaseRecommendations() {
    console.log('🛒 Calculando indicações de compra por grupo...');

    const [salesByProduct, stockByProduct] = await Promise.all([
      this.getLast6MonthsSalesByProduct(),
      this.getStockByProduct()
    ]);

    // Top 100 por volume de venda
    const topCodes = Object.entries(salesByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([cod]) => cod);

    if (topCodes.length === 0) return { byGroup: [], flat: [] };

    const [descriptions, groupMap, groupNames] = await Promise.all([
      sankhyaService.getProductDescriptions(topCodes),
      this.getProductGroups(topCodes),
      this.getGroupNames()
    ]);

    const statusOrder = { CRITICO: 0, URGENTE: 1, BAIXO: 2, ATENCAO: 3, OK: 4 };

    const flat = topCodes.map(cod => {
      const total6m = salesByProduct[cod] || 0;
      const avgMonthly = total6m / 6;
      const stock = stockByProduct[cod] || 0;
      const mesesEstoque = avgMonthly > 0 ? stock / avgMonthly : 999;
      const targetStock = avgMonthly * 6;
      const sugestaoCompra = Math.max(0, Math.ceil(targetStock - stock));

      const grpInfo = groupMap[cod] || { codGrupo: '', descGrupo: '' };
      const descGrupo = grpInfo.descGrupo ||
                        groupNames[grpInfo.codGrupo] ||
                        grpInfo.codGrupo ||
                        'SEM GRUPO';

      let status = 'OK', statusLabel = '🟢 Adequado';
      if (mesesEstoque < 1)      { status = 'CRITICO'; statusLabel = '🔴 Crítico'; }
      else if (mesesEstoque < 2) { status = 'URGENTE'; statusLabel = '🟠 Urgente'; }
      else if (mesesEstoque < 4) { status = 'BAIXO';   statusLabel = '🟡 Baixo'; }
      else if (mesesEstoque < 6) { status = 'ATENCAO'; statusLabel = '🔵 Atenção'; }

      return {
        codprod: cod,
        descricao: descriptions[cod] || `Produto ${cod}`,
        grupo: descGrupo,
        codGrupo: grpInfo.codGrupo,
        estoque: Math.round(stock),
        mediaVendaMensal: Math.round(avgMonthly * 10) / 10,
        mesesEstoque: Math.round(mesesEstoque * 10) / 10,
        sugestaoCompra,
        status,
        statusLabel
      };
    }).sort((a, b) => (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4));

    // Agrupa por grupo de produto
    const grouped = {};
    flat.forEach(item => {
      const g = item.grupo || 'SEM GRUPO';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(item);
    });

    // Converte para array ordenado por grupo com mais críticos primeiro
    const byGroup = Object.entries(grouped).map(([grupo, items]) => {
      const criticos = items.filter(i => i.status === 'CRITICO' || i.status === 'URGENTE').length;
      const totalCompra = items.reduce((s, i) => s + i.sugestaoCompra, 0);
      return { grupo, items, criticos, totalCompra };
    }).sort((a, b) => b.criticos - a.criticos || b.totalCompra - a.totalCompra);

    return { byGroup, flat };
  }

  /**
   * Dados completos do dashboard
   */
  async getDashboardData() {
    console.log('📊 Montando dashboard...');

    const [productsData, monthSales, last6Months, vendorNames] = await Promise.all([
      this.getTotalProducts(),
      this.getCurrentMonthSales(),
      this.getLast6MonthsSales(),
      this.getVendorNames()
    ]);

    const salesByVendor = Object.entries(monthSales.byVendorCode)
      .map(([cod, total]) => ({
        nome: vendorNames[cod] || `Vendedor ${cod}`,
        total: Math.round(total * 100) / 100
      }))
      .sort((a, b) => b.total - a.total);

    const avg6m = last6Months.length > 0
      ? last6Months.reduce((s, m) => s + m.total, 0) / last6Months.length
      : 0;

    return {
      kpis: {
        totalProducts: productsData.total,
        monthSalesTotal: Math.round(monthSales.total * 100) / 100,
        monthSalesCount: monthSales.count,
        avg6MonthsSales: Math.round(avg6m * 100) / 100
      },
      last6Months,
      salesByVendor,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new DashboardService();
