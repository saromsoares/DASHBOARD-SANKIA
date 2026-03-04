const axios = require('axios');
require('dotenv').config();

class SankhyaService {
  constructor() {
    this.baseURL = process.env.SANKHYA_BASE_URL || 'https://api.sankhya.com.br';
    this.bearerToken = null;
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request Interceptor to add Token if available
    this.api.interceptors.request.use((config) => {
      // Skip token for auth endpoints
      if (this.bearerToken && !config.url.includes('/authenticate') && !config.url.includes('/login')) {
        config.headers['Authorization'] = `Bearer ${this.bearerToken}`;
      }
      return config;
    });
  }

  /**
   * Performs authentication to retrieve the Bearer Token.
   */
  /**
   * Performs authentication using OAuth2 Client Credentials.
   */
  async login() {
    try {
      console.log('Authenticating with Sankhya (OAuth2)...');

      // OAuth2 Client Credentials Flow
      // Content-Type must be application/x-www-form-urlencoded
      const authData = new URLSearchParams();
      authData.append('client_id', process.env.SANKHYA_CLIENT_ID);
      authData.append('client_secret', process.env.SANKHYA_CLIENT_SECRET);
      authData.append('grant_type', 'client_credentials');

      const response = await this.api.post('/authenticate', authData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Token': process.env.SANKHYA_TOKEN
        }
      });

      // Based on the user screenshot, the response contains "access_token"
      const token = response.data.access_token;

      if (!token) {
        throw new Error('No access_token received from Sankhya Login');
      }

      this.bearerToken = token;
      console.log('Authentication successful.');
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generic request wrapper with Auto-Retry logic.
   * @param {string} serviceName 
   * @param {object} requestBody 
   * @param {string} module - The Sankhya module to use (e.g., 'mge', 'mgecom'). Defaults to 'mge'.
   */
  async callService(serviceName, requestBody, module = 'mge') {
    if (!this.bearerToken) {
      await this.login();
    }

    const payload = {
      serviceName: serviceName,
      requestBody: requestBody
    };

    try {
      // Dynamic module selection based on documentation
      // https://api.sankhya.com.br/gateway/v1/[modulo]/service.sbr
      const response = await this.api.post(`/gateway/v1/${module}/service.sbr?serviceName=${serviceName}&outputType=json`, payload);

      if (response.data.status === '0' || response.data.status === 0) {
        const statusMessage = response.data.statusMessage || '';
        if (statusMessage.toLowerCase().includes('sessão') || statusMessage.toLowerCase().includes('inválid')) {
          console.log('Session expired. Re-authenticating...');
          this.bearerToken = null;
          await this.login();
          // Retry
          const retryResponse = await this.api.post(`/gateway/v1/${module}/service.sbr?serviceName=${serviceName}&outputType=json`, payload);
          return retryResponse.data;
        }
        throw new Error(`Sankhya Error: ${statusMessage}`);
      }

      return response.data;
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('HTTP 401/403. Re-authenticating...');
        this.bearerToken = null;
        await this.login();
        // Retry
        const retryResponse = await this.api.post(`/gateway/v1/${module}/service.sbr?serviceName=${serviceName}&outputType=json`, payload);
        return retryResponse.data;
      }
      throw error;
    }
  }

  // --- Specific Business Methods ---

  /**
   * Fetches detailed product info including aggregated stock and base price.
   * @param {string|number} term - Product Code or Description
   */
  /**
   * Performs a smart search for products and returns a summary with stock.
   * Ideal for AI Agents.
   * @param {string} term - Search keywords (e.g. "lampada led")
   */
  async getProductInfo(term) {
    console.log(`🔎 Intelligent Search for: "${term}"`);

    const terms = term.toUpperCase().split(/\s+/).filter(t => t.length > 0);
    const termConditions = terms.map(t => {
      // Check if term is strictly numeric for CODPROD
      const isNumeric = /^\d+$/.test(t);
      const conditions = [
        `DESCRPROD LIKE '%${t}%'`,
        `REFERENCIA LIKE '%${t}%'`,
        `MARCA LIKE '%${t}%'`
      ];

      if (isNumeric) {
        conditions.push(`CODPROD = ${t}`);
      }

      return `(${conditions.join(' OR ')})`;
    }).join(' AND ');

    const where = `(${termConditions}) AND ATIVO = 'S'`;

    const body = {
      dataSet: {
        rootEntity: "Produto",
        includePresentationFields: "S",
        offsetPage: "0",
        criteria: {
          expression: { "$": where }
        },
        entity: {
          fieldset: {
            list: "CODPROD,DESCRPROD,REFERENCIA"
          }
        }
      }
    };

    try {
      const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;

      if (!entities || (Array.isArray(entities) && entities.length === 0)) {
        return `Não encontrei nenhum produto com os termos "${term}".`;
      }

      const list = Array.isArray(entities) ? entities : [entities];

      // Limit to top 5 to avoid overwhelming the chat
      const topProducts = list.slice(0, 5);

      let message = `Encontrei ${list.length} produtos. Aqui estão os principais:\n\n`;

      // Parallel stock and price fetching for speed
      const promises = topProducts.map(async (p) => {
        const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
        const desc = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;
        const ref = p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA || '-';

        // Fetch Stock and Price in parallel
        const [stock, price] = await Promise.all([
          this.getProductStockREST(cod),
          this.getProductPriceREST(cod, 6)
        ]);

        const priceDisplay = (price === "0.00") ? "Sob Consulta" : `R$ ${price}`;

        return `📦 *${desc}* (Cód: ${cod})\n   Ref: ${ref} | Estoque: *${stock} un.* | Preço: *${priceDisplay}*`;
      });

      const results = await Promise.all(promises);
      message += results.join('\n\n');

      return message;

    } catch (err) {
      console.error('Error in getProductInfo:', err);
      return "Ocorreu um erro ao consultar os produtos.";
    }
  }

  /**
   * Helper: Get Total Stock using Dedicated REST API (Sankhya Om 4.34+)
   * GET /v1/estoque/produtos/{codigoProduto}
   */
  async getProductStockREST(codProd) {
    try {
      console.log(`📦 Fetching Stock for ${codProd} via REST API...`);
      // Note: Endpoint does NOT use /gateway/v1/mge/service.sbr pattern
      // It uses /v1/estoque/produtos/{id}
      // We assume it accepts the same Bearer token.

      const response = await this.api.get(`/v1/estoque/produtos/${codProd}`, {
        headers: {
          appkey: process.env.SANKHYA_CLIENT_ID
        }
      });

      const data = response.data;
      if (!data || !data.estoque) return 0;

      // Sum stock across all locations/companies returned
      // Response body: { estoque: [ { codigoEmpresa, codigoLocal, estoque: number }, ... ] }
      const stockList = data.estoque;

      let totalStock = 0;
      if (Array.isArray(stockList)) {
        stockList.forEach(item => {
          totalStock += (item.estoque || 0);
        });
      }

      return totalStock;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        // 404 means data not found (no movement?), treat as 0
        return 0;
      }
      console.error(`Error fetching stock (REST) for ${codProd}:`, err.message);
      if (err.response) console.error('   Details:', err.response.data);
      return 0;
    }
  }

  /**
   * Helper: Get Total Stock from TGFEST (Legacy/Fallback)
   */
  async getProductStockLegacy(codProd) {
    try {
      const body = {
        dataSet: {
          rootEntity: "Estoque", // TGFEST
          includePresentationFields: "N",
          offsetPage: "0",
          criteria: {
            expression: `CODPROD = ${codProd}`
          },
          entity: {
            fieldset: {
              list: "ESTOQUE,RESERVADO"
            }
          }
        }
      };

      const result = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = result.responseBody?.entities?.entity;

      if (!entities) return 0;

      const list = Array.isArray(entities) ? entities : [entities];

      // Sum stock across all companies/locations
      let totalStock = 0;
      list.forEach(item => {
        const qty = parseFloat(item.f0?.['$'] || item.ESTOQUE?.['$'] || 0);
        // We could also subtract RESERVADO if needed
        totalStock += qty;
      });

      return totalStock;
    } catch (err) {
      console.error(`Error fetching stock for ${codProd}:`, err.message);
      return 0;
    }
  }

  /**
   * Helper: Get Product Price using Specific REST API (Sankhya Om 4.34+)
   * GET /v1/precos/produto/{codigoProduto}/tabela/{codigoTabela}?pagina=1
   */
  async getProductPriceREST(codProd, nutab = 6) {
    try {
      console.log(`💲 Fetching Price for ${codProd} on Table ${nutab} via REST API...`);

      const response = await this.api.get(`/v1/precos/produto/${codProd}/tabela/${nutab}?pagina=1`, {
        headers: {
          appkey: process.env.SANKHYA_CLIENT_ID
        }
      });

      const data = response.data;
      if (!data) return "0.00";

      // Expected response structure based on documentation/pattern:
      // { precoBase: 123.45, ... } or { preco: 123.45 }
      // The user mentioned it works in Postman, we'll log the full response to debug first structure.
      // console.log('   🔍 Raw Price Data:', JSON.stringify(data));

      // Response Structure Analysis:
      // The log showed fragment: `...valor":9}]}` which suggests an array.
      // Likely: { precos: [ { valor: 9, ... } ] } or similar.
      // We will try to find 'valor' in the first element of any array or at root.

      let price = 0;

      if (data.produtos && Array.isArray(data.produtos) && data.produtos.length > 0) {
        price = data.produtos[0].valor;
      } else if (data.precos && Array.isArray(data.precos) && data.precos.length > 0) {
        price = data.precos[0].valor;
      } else if (data.result && Array.isArray(data.result) && data.result.length > 0) {
        price = data.result[0].valor;
      } else if (data.responseBody?.result && Array.isArray(data.responseBody.result) && data.responseBody.result.length > 0) {
        price = data.responseBody.result[0].valor;
      } else if (Array.isArray(data) && data.length > 0) {
        price = data[0].valor;
      } else {
        price = data.valor || data.preco || data.precoBase || data.vlrVenda || 0;
      }

      return parseFloat(price).toFixed(2);

    } catch (err) {
      console.error(`Error fetching price (REST) for ${codProd}:`, err.message);
      if (err.response) console.error('   Details:', err.response.data);
      return "0.00";
    }
  }

  /**
   * Helper: Get First Active Price from TGFEXC
   * Note: This gets the raw table price. Real pricing is complex (taxes, discounts).
   */
  async getProductPrice(codProd, nutab = 0) {
    try {
      const body = {
        dataSet: {
          rootEntity: "ExcecaoPreco", // TGFEXC
          includePresentationFields: "N",
          offsetPage: "0",
          criteria: {
            expression: { "$": "CODPROD = ? AND NUTAB = ?" },
            parameter: [
              { "$": String(codProd), "type": "I" },
              { "$": "0", "type": "I" }
            ]
          },
          entity: {
            fieldset: {
              list: "VLRVENDA,NUTAB"
            }
          }
        }
      };

      const result = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = result.responseBody?.entities?.entity;

      if (!entities) return "0.00";

      // Just grab the first one found
      const list = Array.isArray(entities) ? entities : [entities];
      const firstPrice = list[0];

      const price = parseFloat(firstPrice.f0?.['$'] || firstPrice.VLRVENDA?.['$'] || 0);

      return price.toFixed(2);
    } catch (err) {
      // Suppress persistence errors (common when Table ID is missing)
      if (!err.message.includes('mecanismo de persistência')) {
        console.error(`Error fetching price for ${codProd}:`, err.message);
      }
      return "0.00";
    }
  }

  async getFinancialPending(cnpj) {
    // 1. First find Parceiro (Client) by CGC_CPF (TGFPAR)
    // 2. Then find Financeiro (TGFFIN)

    // Simplification: Direct query on TGFFIN using JOIN logic in criteria if possible, 
    // OR assuming we can filter by 'Parceiro.CGC_CPF' directly in some entities.
    // Let's try finding the Partner first.

    try {
      // Step A: Find CODPARC
      const partnerWhere = `CGC_CPF = '${cnpj}'`;
      const partnerBody = {
        dataSet: {
          rootEntity: "Parceiro",
          includePresentationFields: "N",
          offsetPage: "0",
          criteria: { expression: partnerWhere },
          entity: { fieldset: { list: "CODPARC,NOMEPARC" } }
        }
      };

      const partnerRes = await this.callService('CRUDServiceProvider.loadRecords', partnerBody);
      const partnerEnt = partnerRes.responseBody?.entities?.entity;

      if (!partnerEnt) return `Cliente com CNPJ ${cnpj} não encontrado.`;

      const partner = Array.isArray(partnerEnt) ? partnerEnt[0] : partnerEnt;
      const codParc = partner.f0?.['$'] || partner.CODPARC;

      // Step B: Find Pending Finance (TGFFIN)
      // DHBAIXA IS NULL means it's open. RECDESP = 1 (Receita) maybe?
      const finWhere = `CODPARC = ${codParc} AND DHBAIXA IS NULL`;

      const finBody = {
        dataSet: {
          rootEntity: "Financeiro",
          includePresentationFields: "N",
          offsetPage: "0",
          criteria: { expression: finWhere },
          entity: { fieldset: { list: "NUFIN,VLRDESDOB" } }
        }
      };

      const finRes = await this.callService('CRUDServiceProvider.loadRecords', finBody);
      const finEnts = finRes.responseBody?.entities?.entity;

      let total = 0;
      let count = 0;

      if (finEnts) {
        const list = Array.isArray(finEnts) ? finEnts : [finEnts];
        count = list.length;
        list.forEach(item => {
          const val = parseFloat(item.f1?.['$'] || item.VLRDESDOB?.['$'] || 0);
          total += val;
        });
      }

      return `O cliente possui ${count} títulos em aberto totalizando R$ ${total.toFixed(2)}.`;
    } catch (err) {
      console.error('Error fetching finance:', err);
      return "Erro ao consultar financeiro.";
    }
  }

  async getFiscalStatus(numNota) {
    try {
      const where = `NUMNOTA = ${numNota}`;
      const body = {
        dataSet: {
          rootEntity: "Nota", // TGFCAB
          includePresentationFields: "N",
          offsetPage: "0",
          criteria: { expression: where },
          entity: { fieldset: { list: "STATUSNOTA" } } // 'STATUSNOTA' or similar field
        }
      };

      const res = await this.callService('CRUDServiceProvider.loadRecords', body);
      const ent = res.responseBody?.entities?.entity;

      if (!ent) return `Nota ${numNota} não encontrada.`;

      const note = Array.isArray(ent) ? ent[0] : ent;
      const status = note.f0?.['$'] || note.STATUSNOTA;

      // Map status code to text if necessary (Example: 'L' = Liberada, 'A' = Aprovada)
      // Returning raw for now.
      return `Status da nota ${numNota}: ${status}`;
    } catch (err) {
      console.error('Fiscal error:', err);
      return "Erro ao consultar nota fiscal.";
    }
  }

  /**
   * Get orders placed by a customer using their CPF or CNPJ.
   * @param {string} identifier - Customer's CPF or CNPJ (clean numbers)
   * @returns {object} List of orders
   */
  async getOrdersByCpfCnpj(identifier) {
    try {
      // clean input (keep only numbers)
      const cleanId = identifier.replace(/\D/g, '');

      if (!cleanId) {
        return {
          success: false,
          message: "CPF/CNPJ inválido fornecido."
        };
      }

      console.log(`🔎 Seeking orders for CPF/CNPJ: ${cleanId}`);

      // Subquery filter: CODPARC IN (SELECT CODPARC FROM TGFPAR WHERE CGC_CPF = '...')
      // AND TIPMOV = 'P' (Pedido)
      const where = `this.CODPARC IN (SELECT CODPARC FROM TGFPAR WHERE CGC_CPF = '${cleanId}') AND this.TIPMOV IN ('P', 'V')`;

      const body = {
        dataSet: {
          rootEntity: "CabecalhoNota", // TGFCAB
          includePresentationFields: "S",
          offsetPage: "0",
          criteria: {
            expression: { "$": where }
          },
          entity: {
            fieldset: {
              list: "NUNOTA,NUMNOTA,DTNEG,VLRNOTA,STATUSNOTA"
            }
          }
        }
      };

      const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;

      if (!entities || (Array.isArray(entities) && entities.length === 0)) {
        return {
          success: true,
          data: [],
          message: `Nenhum pedido encontrado para o CPF/CNPJ ${cleanId}.`
        };
      }

      const list = Array.isArray(entities) ? entities : [entities];

      // Map results
      const orders = list.map(nota => {
        const nunota = nota.f0?.['$'] || nota.NUNOTA?.['$'] || nota.NUNOTA;
        const numnota = nota.f1?.['$'] || nota.NUMNOTA?.['$'] || nota.NUMNOTA;
        const dtneg = nota.f2?.['$'] || nota.DTNEG?.['$'] || nota.DTNEG;
        const vlrnota = nota.f3?.['$'] || nota.VLRNOTA?.['$'] || nota.VLRNOTA;
        const statusnota = nota.f4?.['$'] || nota.STATUSNOTA?.['$'] || nota.STATUSNOTA;

        const statusMap = {
          'L': 'Liberada',
          'A': 'Aprovada',
          'P': 'Pendente',
          'C': 'Cancelada',
          'E': 'Em elaboração' // ... add others as needed
        };
        const statusText = statusMap[statusnota] || statusnota;

        return {
          nunota: nunota,
          numnota: numnota,
          data: dtneg,
          valor: parseFloat(vlrnota || 0).toFixed(2),
          status: statusText,
          statusCod: statusnota
        };
      });

      // Sort by Date Descending (JS Side)
      orders.sort((a, b) => {
        if (!a.data || !b.data) return 0;
        const [dA, mA, yA] = a.data.split('/').map(Number);
        const [dB, mB, yB] = b.data.split('/').map(Number);
        const dateA = new Date(yA, mA - 1, dA);
        const dateB = new Date(yB, mB - 1, dB);
        return dateB - dateA; // Descending
      });

      // Format a summary message
      let msg = `Encontrei ${orders.length} pedidos para o documento ${cleanId}:\n\n`;
      // Show top 5 most recent (assuming list order or just first 5)
      // Ideally we should sort by DTNEG desc if API didn't, but let's just list
      orders.slice(0, 5).forEach(o => {
        msg += `🛒 Pedido ${o.numnota} (Data: ${o.data})\n   Valor: R$ ${o.valor} | Status: ${o.status}\n\n`;
      });
      if (orders.length > 5) {
        msg += `... e mais ${orders.length - 5} pedidos.`;
      }

      return {
        success: true,
        data: orders,
        message: msg
      };

    } catch (err) {
      console.error('Error in getOrdersByCpfCnpj:', err.message);
      if (err.response) {
        console.error('   Details:', JSON.stringify(err.response.data));
      }
      return {
        success: false,
        message: "Erro ao consultar pedidos por CPF/CNPJ."
      };
    }
  }

  /**
   * Get fiscal information from an order/invoice.
   * @param {string|number} searchTerm - NUNOTA (unique note number) or NUMNOTA (invoice number)
   * @returns {object} Fiscal information including NUNOTA, NUMNOTA, CHAVENFE, STATUSNOTA, etc.
   */
  async getOrderFiscalInfo(searchTerm) {
    try {
      // Try to determine if it's NUNOTA or NUMNOTA based on context
      // NUNOTA is typically larger and unique across system
      // NUMNOTA is the invoice number (can repeat across companies)
      const isNumeric = !isNaN(searchTerm);

      if (!isNumeric) {
        return `Parâmetro inválido. Informe um número de nota válido.`;
      }

      // Search by NUNOTA first (more precise), fallback to NUMNOTA
      const where = `NUNOTA = ${searchTerm} OR NUMNOTA = ${searchTerm}`;

      const body = {
        dataSet: {
          rootEntity: "CabecalhoNota", // TGFCAB
          includePresentationFields: "S",
          offsetPage: "0",
          criteria: {
            expression: { "$": "NUNOTA = ? OR NUMNOTA = ?" },
            parameter: [
              { "$": String(searchTerm), "type": "I" },
              { "$": String(searchTerm), "type": "I" }
            ]
          },
          entity: {
            fieldset: {
              list: "NUNOTA,NUMNOTA,CHAVENFE,STATUSNOTA,CODPARC,DTNEG,VLRNOTA,TIPMOV,CODTIPOPER"
            }
          }
        }
      };

      console.log(`📋 Querying Nota (Invoice) with: ${searchTerm}`);

      const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;

      if (!entities || (Array.isArray(entities) && entities.length === 0)) {
        return {
          success: false,
          message: `Não encontrei nenhuma nota com o número "${searchTerm}".`
        };
      }

      const list = Array.isArray(entities) ? entities : [entities];
      const nota = list[0]; // Take first match

      // Extract fields (handling both presentation and raw formats)
      const nunota = nota.f0?.['$'] || nota.NUNOTA?.['$'] || nota.NUNOTA;
      const numnota = nota.f1?.['$'] || nota.NUMNOTA?.['$'] || nota.NUMNOTA;
      const chavenfe = nota.f2?.['$'] || nota.CHAVENFE?.['$'] || nota.CHAVENFE || 'N/A';
      const statusnota = nota.f3?.['$'] || nota.STATUSNOTA?.['$'] || nota.STATUSNOTA;
      const codparc = nota.f4?.['$'] || nota.CODPARC?.['$'] || nota.CODPARC;
      const dtneg = nota.f5?.['$'] || nota.DTNEG?.['$'] || nota.DTNEG;
      const vlrnota = nota.f6?.['$'] || nota.VLRNOTA?.['$'] || nota.VLRNOTA;
      const tipmov = nota.f7?.['$'] || nota.TIPMOV?.['$'] || nota.TIPMOV;
      const codtipoper = nota.f8?.['$'] || nota.CODTIPOPER?.['$'] || nota.CODTIPOPER;

      // Map status code to readable text (common codes)
      const statusMap = {
        'L': 'Liberada',
        'A': 'Aprovada',
        'P': 'Pendente',
        'C': 'Cancelada',
        'E': 'Em elaboração'
      };
      const statusText = statusMap[statusnota] || statusnota;

      return {
        success: true,
        data: {
          nunota: nunota,
          numnota: numnota,
          chavenfe: chavenfe,
          status: statusnota,
          statusText: statusText,
          codparc: codparc,
          dtneg: dtneg,
          vlrnota: parseFloat(vlrnota || 0).toFixed(2),
          tipmov: tipmov,
          codtipoper: codtipoper
        },
        message: `Nota #${numnota} (NUNOTA: ${nunota})\nStatus: ${statusText}\nValor: R$ ${parseFloat(vlrnota || 0).toFixed(2)}\nData: ${dtneg}\nChave NF-e: ${chavenfe}`
      };
    } catch (err) {
      console.error('Error fetching fiscal info:', err);
      return {
        success: false,
        message: "Erro ao consultar informações fiscais."
      };
    }
  }

  /**
   * Get items/products from an invoice.
   * @param {string|number} nunota - NUNOTA (unique note number) from getOrderFiscalInfo
   * @returns {object} List of products with details
   */
  async getOrderItems(nunota) {
    try {
      const isNumeric = !isNaN(nunota);

      if (!isNumeric) {
        return {
          success: false,
          message: `Parâmetro inválido. Informe um NUNOTA válido.`
        };
      }

      const where = `NUNOTA = ${nunota}`;

      const body = {
        dataSet: {
          rootEntity: "ItemNota", // TGFITE
          includePresentationFields: "S",
          offsetPage: "0",
          criteria: {
            expression: { "$": "NUNOTA = ?" },
            parameter: [
              { "$": String(nunota), "type": "I" }
            ]
          },
          entity: {
            fieldset: {
              list: "SEQUENCIA,CODPROD,QTDNEG,VLRUNIT,VLRTOT"
            }
          }
        }
      };

      console.log(`📦 Querying ItemNota (Invoice Items) for NUNOTA: ${nunota}`);

      const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;

      if (!entities || (Array.isArray(entities) && entities.length === 0)) {
        return {
          success: false,
          message: `Não encontrei itens para a nota NUNOTA ${nunota}.`
        };
      }

      const list = Array.isArray(entities) ? entities : [entities];

      const items = list.map(item => {
        // Extract fields (handling both presentation and raw formats)
        const sequencia = item.f0?.['$'] || item.SEQUENCIA?.['$'] || item.SEQUENCIA;
        const codprod = item.f1?.['$'] || item.CODPROD?.['$'] || item.CODPROD;
        const qtdneg = item.f2?.['$'] || item.QTDNEG?.['$'] || item.QTDNEG;
        const vlrunit = item.f3?.['$'] || item.VLRUNIT?.['$'] || item.VLRUNIT;
        const vlrtot = item.f4?.['$'] || item.VLRTOT?.['$'] || item.VLRTOT;

        // Description can come from item itself or joined Produto entity
        const descrprod = item.f5?.['$'] ||
          item.DESCRPROD?.['$'] ||
          item.DESCRPROD ||
          item.Produto?.DESCRPROD?.['$'] ||
          item.Produto?.DESCRPROD ||
          'Produto sem descrição';

        return {
          sequencia: sequencia,
          codprod: codprod,
          descricao: descrprod,
          quantidade: parseFloat(qtdneg || 0),
          valorUnitario: parseFloat(vlrunit || 0).toFixed(2),
          valorTotal: parseFloat(vlrtot || 0).toFixed(2)
        };
      });

      // Build formatted message
      let message = `📋 Itens da Nota NUNOTA ${nunota}:\n\n`;
      items.forEach((item, index) => {
        message += `${index + 1}. ${item.descricao} (Cód: ${item.codprod})\n`;
        message += `   Qtd: ${item.quantidade} un. | Unit: R$ ${item.valorUnitario} | Total: R$ ${item.valorTotal}\n\n`;
      });

      const totalGeral = items.reduce((sum, item) => sum + parseFloat(item.valorTotal), 0);
      message += `Total: R$ ${totalGeral.toFixed(2)}`;

      return {
        success: true,
        data: {
          nunota: nunota,
          itemCount: items.length,
          items: items,
          total: totalGeral.toFixed(2)
        },
        message: message
      };
    } catch (err) {
      console.error('Error fetching order items:', err);
      return {
        success: false,
        message: "Erro ao consultar itens da nota."
      };
    }
  }
  /**
   * Get partner name by code
   * @param {string|number} codParc 
   */
  async getPartnerName(codParc) {
    try {
      const body = {
        dataSet: {
          rootEntity: "Parceiro", // TGFPAR
          includePresentationFields: "S",
          offsetPage: "0",
          criteria: {
            expression: { "$": "CODPARC = ?" },
            parameter: [{ "$": String(codParc), "type": "I" }]
          },
          entity: {
            fieldset: { list: "NOMEPARC" }
          }
        }
      };

      const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;

      if (!entities) return "Consumidor Final / Desconhecido";

      const list = Array.isArray(entities) ? entities : [entities];
      const name = list[0].f0?.['$'] || list[0].NOMEPARC?.['$'] || list[0].NOMEPARC;

      return name || "Nome não disponível";
    } catch (err) {
      console.error('Error fetching partner:', err.message);
      return "Erro ao buscar cliente";
    }
  }

  /**
   * Get descriptions for a list of product codes
   * @param {Array<number>} codProdList 
   * @returns {Object} Map of CODPROD -> DESCRPROD
   */
  async getProductDescriptions(codProdList) {
    if (!codProdList || codProdList.length === 0) return {};

    // Remove duplicates
    const uniqueCodes = [...new Set(codProdList)];
    const inClause = uniqueCodes.join(',');

    try {
      const body = {
        dataSet: {
          rootEntity: "Produto", // TGFPRO
          includePresentationFields: "S",
          offsetPage: "0",
          criteria: {
            expression: { "$": `CODPROD IN (${inClause})` }
          },
          entity: {
            fieldset: { list: "CODPROD,DESCRPROD" }
          }
        }
      };

      const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;

      const map = {};
      if (entities) {
        const list = Array.isArray(entities) ? entities : [entities];
        list.forEach(p => {
          const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
          const desc = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;
          map[cod] = desc;
        });
      }
      return map;
    } catch (err) {
      console.error('Error fetching product descriptions:', err.message);
      return {};
    }
  }

  /**
   * Resolve a search term (code or reference) to a single product.
   * @param {string} term - CODPROD or REFERENCIA
   * @returns {Promise<{codprod: string, descricao: string, referencia: string} | null>}
   */
  async findProduct(term) {
    try {
      const isNumeric = /^\d+$/.test(term);
      const conditions = [
        `REFERENCIA = '${term}'`,
        `DESCRPROD LIKE '%${term}%'`,
        `MARCA LIKE '%${term}%'`
      ];

      if (isNumeric) {
        conditions.push(`CODPROD = ${term}`);
      }

      const where = `(${conditions.join(' OR ')}) AND ATIVO = 'S'`;

      const body = {
        dataSet: {
          rootEntity: "Produto",
          includePresentationFields: "S",
          offsetPage: "0",
          criteria: {
            expression: { $: where }
          },
          entity: {
            fieldset: {
              list: "CODPROD,DESCRPROD,REFERENCIA"
            }
          }
        }
      };

      const result = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = result.responseBody?.entities?.entity;

      if (!entities) return null;

      const list = Array.isArray(entities) ? entities : [entities];
      const p = list[0]; // Take best match (first one)

      return {
        codprod: p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD,
        descricao: p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD,
        referencia: p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA
      };

    } catch (err) {
      console.error(`Error resolving product for term "${term}":`, err.message);
      return null;
    }
  }
}

module.exports = new SankhyaService();
