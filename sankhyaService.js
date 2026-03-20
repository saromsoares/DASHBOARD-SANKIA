const axios = require('axios');
require('dotenv').config();

class SankhyaService {
  constructor() {
    this.baseURL = process.env.SANKHYA_BASE_URL || 'https://api.sankhya.com.br';
    this.bearerToken = null;
    this._loginPromise = null; // mutex: only one login at a time
    this._queue = [];          // request queue
    this._activeRequests = 0;
    this._maxConcurrent = 3;   // max simultaneous Sankhya API calls
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 120000, // 2 min timeout per request
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
    // Mutex: if a login is already in progress, wait for it instead of starting another
    if (this._loginPromise) {
      return this._loginPromise;
    }

    this._loginPromise = this._doLogin();
    try {
      await this._loginPromise;
    } finally {
      this._loginPromise = null;
    }
  }

  async _doLogin() {
    try {
      const clientId = (process.env.SANKHYA_CLIENT_ID || '').trim();
      const clientSecret = (process.env.SANKHYA_CLIENT_SECRET || '').trim();
      const xToken = (process.env.SANKHYA_TOKEN || '').trim();
      console.log(`Authenticating with Sankhya (OAuth2)... base=${this.baseURL}`);

      const authData = new URLSearchParams();
      authData.append('client_id', clientId);
      authData.append('client_secret', clientSecret);
      authData.append('grant_type', 'client_credentials');

      const response = await this.api.post('/authenticate', authData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Token': xToken
        }
      });

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
   * Semaphore: wait until a slot is available.
   */
  _acquireSlot() {
    return new Promise(resolve => {
      if (this._activeRequests < this._maxConcurrent) {
        this._activeRequests++;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  _releaseSlot() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next();
    } else {
      this._activeRequests--;
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

    await this._acquireSlot();

    const payload = {
      serviceName: serviceName,
      requestBody: requestBody
    };

    const url = `/gateway/v1/${module}/service.sbr?serviceName=${serviceName}&outputType=json`;

    try {
      const response = await this.api.post(url, payload);

      if (response.data.status === '0' || response.data.status === 0) {
        const statusMessage = response.data.statusMessage || '';
        if (statusMessage.toLowerCase().includes('sessão') || statusMessage.toLowerCase().includes('inválid')) {
          console.log('Session expired. Re-authenticating...');
          this.bearerToken = null;
          await this.login();
          const retryResponse = await this.api.post(url, payload);
          return retryResponse.data;
        }
        throw new Error(`Sankhya Error: ${statusMessage}`);
      }

      return response.data;
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log(`HTTP ${error.response.status}. Re-authenticating... (current token: ${this.bearerToken ? 'exists' : 'null'})`);
        console.log('401 response data:', JSON.stringify(error.response.data));
        this.bearerToken = null;
        await this.login();
        console.log(`Re-auth done. New token: ${this.bearerToken ? 'exists' : 'null'}`);
        const retryResponse = await this.api.post(url, payload);
        return retryResponse.data;
      }
      throw error;
    } finally {
      this._releaseSlot();
    }
  }

  // --- Specific Business Methods ---

  /**
   * Sanitize a string for use in SQL/CRUD expressions.
   * Escapes single quotes to prevent SQL injection.
   */
  _sanitize(str) {
    if (str == null) return '';
    return String(str).replace(/'/g, "''");
  }

  /**
   * Validate that a value is strictly numeric (integer).
   */
  _isNumericId(val) {
    return /^\d+$/.test(String(val).trim());
  }

  /**
   * Performs a smart search for products and returns a summary with stock.
   * Ideal for AI Agents.
   * @param {string} term - Search keywords (e.g. "lampada led")
   */
  async getProductInfo(term) {
    console.log(`🔎 Intelligent Search for: "${term}"`);

    const terms = term.toUpperCase().split(/\s+/).filter(t => t.length > 0);
    const termConditions = terms.map(t => {
      const safe = this._sanitize(t);
      const isNumeric = this._isNumericId(t);
      const conditions = [
        `DESCRPROD LIKE '%${safe}%'`,
        `REFERENCIA LIKE '%${safe}%'`,
        `MARCA LIKE '%${safe}%'`
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
      const safeCnpj = this._sanitize(cnpj.replace(/\D/g, ''));
      const partnerWhere = `CGC_CPF = '${safeCnpj}'`;
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
        return { success: false, message: 'Parâmetro inválido. Informe um número de nota válido.' };
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
   * Get partner names in bulk by CODPARC list.
   * @param {Array<string>} codParcList - List of partner codes
   * @returns {Object} Map of CODPARC -> NOMEPARC
   */
  async getPartnerNamesBulk(codParcList) {
    if (!codParcList || codParcList.length === 0) return {};
    const map = {};
    const BATCH_SIZE = 500;

    for (let i = 0; i < codParcList.length; i += BATCH_SIZE) {
      const batch = codParcList.slice(i, i + BATCH_SIZE);
      const inClause = batch.join(',');

      try {
        const sql = `SELECT CODPARC, NOMEPARC FROM TGFPAR WHERE CODPARC IN (${inClause})`;
        const result = await this.executeSQL(sql);
        const rows = result.rows || [];
        rows.forEach(row => {
          const cod = String(row[0]);
          const nome = row[1] || '';
          map[cod] = nome;
        });
      } catch (err) {
        console.error(`Error fetching partner names SQL batch ${i}:`, err.message);
      }
    }

    return map;
  }

  /**
   * Search partners by name, razao social or code (for autocomplete).
   * Uses direct SQL for reliable results.
   * @param {string} term - Search term
   * @returns {Array} List of { codparc, nomeparc }
   */
  async searchPartners(term) {
    if (!term || term.length < 2) return [];

    try {
      const safeTerm = this._sanitize(term).toUpperCase();
      const isNumeric = this._isNumericId(term.trim());

      const where = isNumeric
        ? `CODPARC = ${term.trim()}`
        : `UPPER(NOMEPARC) LIKE '%${safeTerm}%' OR UPPER(RAZAOSOCIAL) LIKE '%${safeTerm}%'`;

      const sql = `SELECT CODPARC, NOMEPARC, RAZAOSOCIAL FROM TGFPAR WHERE (${where}) AND ROWNUM <= 20 ORDER BY NOMEPARC`;

      const result = await this.executeSQL(sql);
      return (result.rows || []).map(row => ({
        codparc: String(row[0]),
        nomeparc: row[1] || row[2] || '',
      }));
    } catch (err) {
      console.error('Error searching partners:', err.message);
      return [];
    }
  }

  /**
   * Get product codes linked to a supplier via CODPARCFORN field on TGFPRO.
   * @param {string} codparc - Partner/supplier code
   * @returns {Array<string>} List of CODPROD
   */
  async getProductCodesByPartner(codparc) {
    if (!codparc || !this._isNumericId(codparc)) return [];

    try {
      const sql = `SELECT CODPROD FROM TGFPRO WHERE CODPARCFORN = ${codparc} AND ATIVO = 'S'`;
      const result = await this.executeSQL(sql);
      return (result.rows || []).map(row => String(row[0]));
    } catch (err) {
      console.error('Error getting products by partner:', err.message);
      return [];
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
   * Get all child group codes under a parent group (recursive).
   * @param {string} parentGroupCode - e.g. '9901' for ASX, '9902' for ABSOLUX
   * @returns {Set<string>} Set of all group codes under this parent (including parent itself)
   */
  async getGroupChildren(parentGroupCode) {
    const allGroups = new Set();
    allGroups.add(String(parentGroupCode));

    // Fetch all groups and build tree
    let page = 0;
    const groupList = [];
    while (true) {
      const body = {
        dataSet: {
          rootEntity: "GrupoProduto",
          includePresentationFields: "S",
          offsetPage: String(page),
          criteria: {
            expression: { "$": "1=1" }
          },
          entity: {
            fieldset: { list: "CODGRUPOPROD,CODGRUPOPAI" }
          }
        }
      };

      try {
        const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;
        if (!entities) break;

        const list = Array.isArray(entities) ? entities : [entities];
        if (list.length === 0) break;

        list.forEach(g => {
          const cod = String(g.f0?.['$'] || g.CODGRUPOPROD?.['$'] || g.CODGRUPOPROD || '');
          const pai = String(g.f1?.['$'] || g.CODGRUPOPAI?.['$'] || g.CODGRUPOPAI || '');
          groupList.push({ cod, pai });
        });

        page++;
      } catch (err) {
        console.error('Error fetching groups:', err.message);
        break;
      }
    }

    console.log(`[Groups] Fetched ${groupList.length} groups total`);

    // BFS to find all children recursively
    const queue = [String(parentGroupCode)];
    while (queue.length > 0) {
      const current = queue.shift();
      groupList.forEach(g => {
        if (g.pai === current && !allGroups.has(g.cod)) {
          allGroups.add(g.cod);
          queue.push(g.cod);
        }
      });
    }

    console.log(`[Groups] Parent ${parentGroupCode} has ${allGroups.size} groups (including children)`);
    return allGroups;
  }

  /**
   * Get descriptions, reference, brand and group for a list of product codes (batch).
   * Uses SQL for faster fetching (single query per batch vs paginated CRUD).
   * @param {Array<string>} codProdList
   * @returns {Object} Map of CODPROD -> { descrprod, referencia, marca, codgrupoprod }
   */
  async getProductDescriptionsFull(codProdList) {
    if (!codProdList || codProdList.length === 0) return {};

    const map = {};
    const BATCH_SIZE = 500;
    const t0 = Date.now();

    for (let i = 0; i < codProdList.length; i += BATCH_SIZE) {
      const batch = codProdList.slice(i, i + BATCH_SIZE);
      const inClause = batch.join(',');

      const sql = `SELECT CODPROD, DESCRPROD, REFERENCIA, MARCA, CODGRUPOPROD, CODPARCFORN, REFFORN
        FROM TGFPRO
        WHERE CODPROD IN (${inClause})`;

      try {
        const result = await this.executeSQL(sql);
        const rows = result.rows || [];
        rows.forEach(row => {
          const cod = String(row[0]);
          map[cod] = {
            descrprod: row[1] || '',
            referencia: row[2] || '',
            marca: row[3] || '',
            codgrupoprod: String(row[4] || ''),
            codparcforn: String(row[5] || '0'),
            refforn: row[6] || '',
          };
        });
      } catch (err) {
        console.error(`Error fetching product descriptions SQL batch ${i}:`, err.message);
        // Fallback to CRUD for this batch
        await this._getProductDescriptionsFullCRUD(batch, map);
      }
    }

    console.log(`[ProductDescFull] Got ${Object.keys(map).length} products via SQL in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return map;
  }

  /**
   * Fallback: CRUD pagination for product descriptions.
   */
  async _getProductDescriptionsFullCRUD(codProdList, map) {
    const inClause = codProdList.join(',');
    let page = 0;

    while (true) {
      const body = {
        dataSet: {
          rootEntity: "Produto",
          includePresentationFields: "S",
          offsetPage: String(page),
          criteria: {
            expression: { "$": `CODPROD IN (${inClause})` }
          },
          entity: {
            fieldset: { list: "CODPROD,DESCRPROD,REFERENCIA,MARCA,CODGRUPOPROD,CODPARCFORN,REFFORN" }
          }
        }
      };

      try {
        const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;
        if (!entities) break;

        const list = Array.isArray(entities) ? entities : [entities];
        if (list.length === 0) break;

        list.forEach(p => {
          const cod = String(p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD);
          map[cod] = {
            descrprod: p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD || '',
            referencia: p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA || '',
            marca: p.f3?.['$'] || p.MARCA?.['$'] || p.MARCA || '',
            codgrupoprod: String(p.f4?.['$'] || p.CODGRUPOPROD?.['$'] || p.CODGRUPOPROD || ''),
            codparcforn: String(p.f5?.['$'] || p.CODPARCFORN?.['$'] || p.CODPARCFORN || '0'),
            refforn: p.f6?.['$'] || p.REFFORN?.['$'] || p.REFFORN || '',
          };
        });

        page++;
      } catch (err) {
        console.error(`Error fetching product descriptions CRUD page ${page}:`, err.message);
        break;
      }
    }
  }

  // =============================================
  // Dashboard Methods
  // =============================================

  /**
   * Get all active products, paginated.
   * @param {number} page - Page number (0-based)
   * @param {number} pageSize - Items per page
   */
  async getAllActiveProducts(page = 0, pageSize = 50) {
    const body = {
      dataSet: {
        rootEntity: "Produto",
        includePresentationFields: "S",
        offsetPage: String(page),
        criteria: {
          expression: { "$": "ATIVO = 'S'" }
        },
        entity: {
          fieldset: {
            list: "CODPROD,DESCRPROD,REFERENCIA,MARCA,CODGRUPOPROD,USOPROD"
          }
        },
        dataRow: {
          pageSize: String(pageSize)
        }
      }
    };

    const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
    const entities = response.responseBody?.entities?.entity;
    if (!entities) return [];

    const list = Array.isArray(entities) ? entities : [entities];
    return list.map(p => ({
      codprod: p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD,
      descrprod: p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD,
      referencia: p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA || '',
      marca: p.f3?.['$'] || p.MARCA?.['$'] || p.MARCA || '',
      codgrupoprod: p.f4?.['$'] || p.CODGRUPOPROD?.['$'] || p.CODGRUPOPROD || '',
      usoprod: p.f5?.['$'] || p.USOPROD?.['$'] || p.USOPROD || '',
    }));
  }

  /**
   * Get ALL active products by looping through all pages.
   * Sankhya API paginates, so we fetch page by page until empty.
   */
  async getAllActiveProductsFull() {
    // Sankhya API always returns max 50 per page regardless of dataRow.pageSize
    const PAGE_SIZE = 50;
    let allProducts = [];
    let page = 0;

    while (true) {
      console.log(`Fetching products page ${page}...`);
      const batch = await this.getAllActiveProducts(page, PAGE_SIZE);

      if (batch.length === 0) break;
      allProducts = allProducts.concat(batch);
      page++;
    }

    console.log(`Total active products fetched: ${allProducts.length} (${page} pages)`);
    return allProducts;
  }

  /**
   * Get stock locations for a product via REST API.
   * Returns raw array of locations (caller filters).
   */
  async getProductStockLocations(codProd) {
    try {
      if (!this.bearerToken) await this.login();

      const response = await this.api.get(`/v1/estoque/produtos/${codProd}`, {
        headers: { appkey: process.env.SANKHYA_CLIENT_ID }
      });

      const data = response.data;
      if (!data || !data.estoque) return [];
      return Array.isArray(data.estoque) ? data.estoque : [data.estoque];
    } catch (err) {
      if (err.response && err.response.status === 404) return [];
      console.error(`Error fetching stock locations for ${codProd}:`, err.message);
      return [];
    }
  }

  /**
   * Get stock for multiple products in parallel (pool of 10).
   * Returns Map<codprod, filteredStockTotal>.
   */
  async getBulkStock(codProdList) {
    const POOL_SIZE = 20;
    const results = new Map();
    const EXCLUDED_LOCALS = [9901001, 9901002, 9901003, 9901007, 9902002];

    for (let i = 0; i < codProdList.length; i += POOL_SIZE) {
      const batch = codProdList.slice(i, i + POOL_SIZE);
      const promises = batch.map(async (codProd) => {
        const locations = await this.getProductStockLocations(codProd);
        const filtered = locations
          .filter(loc => !EXCLUDED_LOCALS.includes(loc.codigoLocal))
          .reduce((sum, loc) => sum + (loc.estoque || 0), 0);
        return { codProd, stock: filtered };
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ codProd, stock }) => results.set(String(codProd), stock));
    }

    return results;
  }

  /**
   * Get stock for ALL products at once via CRUD (TGFEST).
   * Much faster than individual REST calls.
   * Returns Map<codprod, filteredStockTotal> excluding specified locals.
   */
  async getBulkStockCRUD(codProdList) {
    const EXCLUDED_LOCALS = [9901001, 9901002, 9901003, 9901007, 9902002];
    const results = new Map();
    const BATCH_SIZE = 200; // IN clause limit
    const excludeClause = EXCLUDED_LOCALS.join(',');

    for (let i = 0; i < codProdList.length; i += BATCH_SIZE) {
      const batch = codProdList.slice(i, i + BATCH_SIZE);
      const inClause = batch.join(',');

      const sql = `SELECT EST.CODPROD, SUM(EST.ESTOQUE) AS TOTAL_ESTOQUE
        FROM TGFEST EST
        WHERE EST.CODPROD IN (${inClause})
          AND EST.CODLOCAL NOT IN (${excludeClause})
        GROUP BY EST.CODPROD`;

      try {
        const response = await this.executeSQL(sql);
        const rows = response.rows || [];
        rows.forEach(row => {
          const cod = String(row[0]);
          const est = parseFloat(row[1] || 0);
          if (est !== 0) results.set(cod, est);
        });
      } catch (err) {
        console.error(`Error fetching bulk stock SQL batch ${i}:`, err.message);
      }
    }

    console.log(`[BulkStockCRUD] Got stock for ${results.size} products`);
    return results;
  }

  /**
   * Get sales invoices (Vendas Liberadas) in a date range.
   * Uses SQL for much faster fetching (single query vs dozens of paginated CRUD calls).
   * @param {string} startDate - dd/MM/yyyy
   * @param {string} endDate - dd/MM/yyyy
   */
  async getSalesInvoices(startDate, endDate) {
    const safeStart = this._sanitize(startDate);
    const safeEnd = this._sanitize(endDate);
    // TOP codes matching the Portal de Vendas filters (sales operations only)
    const SALES_TOPS = '1971,1972,1974,1975,1976,1978,1979,1982';
    // Vlr Total Bruto = sum of items (VLRTOT + VLRDESC) without IPI, ICMS-ST or freight
    const sql = `SELECT CAB.NUNOTA, TO_CHAR(CAB.DTNEG, 'DD/MM/YYYY') AS DTNEG,
        NVL((SELECT SUM(NVL(ITE.VLRTOT,0) + NVL(ITE.VLRDESC,0)) FROM TGFITE ITE WHERE ITE.NUNOTA = CAB.NUNOTA), 0) AS VLRBRUTO,
        CAB.CODVEND, CAB.CODPARC, PAR.NOMEPARC
      FROM TGFCAB CAB
      LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
      WHERE CAB.STATUSNOTA = 'L'
        AND CAB.CODTIPOPER IN (${SALES_TOPS})
        AND CAB.DTNEG BETWEEN TO_DATE('${safeStart}', 'DD/MM/YYYY') AND TO_DATE('${safeEnd}', 'DD/MM/YYYY')
      ORDER BY CAB.DTNEG DESC`;

    try {
      const t0 = Date.now();
      const result = await this.executeSQL(sql);
      const rows = result.rows || [];

      const allInvoices = rows.map(row => ({
        nunota: String(row[0]),
        dtneg: row[1] || '',
        vlrnota: parseFloat(row[2] || 0),
        codvend: String(row[3] || '0'),
        codparc: String(row[4] || '0'),
        nomeparc: row[5] || '',
      }));

      console.log(`Sales invoices fetched: ${allInvoices.length} via SQL in ${((Date.now() - t0) / 1000).toFixed(1)}s [${startDate} - ${endDate}]`);
      return allInvoices;
    } catch (err) {
      console.error(`Error fetching sales invoices via SQL:`, err.message);
      // Fallback to CRUD pagination if SQL fails
      return this._getSalesInvoicesCRUD(startDate, endDate);
    }
  }

  /**
   * Fallback: Get sales invoices via CRUD pagination (slower).
   */
  async _getSalesInvoicesCRUD(startDate, endDate) {
    const where = `STATUSNOTA = 'L' AND CODTIPOPER IN (1971,1972,1974,1975,1976,1978,1979,1982) AND DTNEG BETWEEN '${startDate}' AND '${endDate}'`;
    let allInvoices = [];
    let page = 0;

    while (true) {
      const body = {
        dataSet: {
          rootEntity: "CabecalhoNota",
          includePresentationFields: "S",
          offsetPage: String(page),
          criteria: {
            expression: { "$": where }
          },
          entity: {
            fieldset: {
              list: "NUNOTA,DTNEG,VLRNOTA,CODVEND,CODPARC"
            }
          }
        }
      };

      const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
      const entities = response.responseBody?.entities?.entity;
      if (!entities) break;

      const list = Array.isArray(entities) ? entities : [entities];
      const mapped = list.map(n => ({
        nunota: n.f0?.['$'] || n.NUNOTA?.['$'] || n.NUNOTA,
        dtneg: n.f1?.['$'] || n.DTNEG?.['$'] || n.DTNEG,
        vlrnota: parseFloat(n.f2?.['$'] || n.VLRNOTA?.['$'] || n.VLRNOTA || 0),
        codvend: n.f3?.['$'] || n.CODVEND?.['$'] || n.CODVEND || '0',
        codparc: n.f4?.['$'] || n.CODPARC?.['$'] || n.CODPARC || '0',
        nomeparc: n.f6?.['$'] || '',
      }));

      allInvoices = allInvoices.concat(mapped);
      if (list.length === 0) break;
      page++;
    }

    console.log(`Sales invoices fetched (CRUD fallback): ${allInvoices.length} (${page + 1} pages) [${startDate} - ${endDate}]`);
    return allInvoices;
  }

  /**
   * Get sales items by list of NUNOTAs.
   * Uses SQL for much faster fetching (batched queries vs dozens of paginated CRUD calls).
   */
  async getSalesItemsByNunotas(nunotas) {
    const BATCH_SIZE = 500; // SQL IN clause batch size (larger than CRUD)
    let allItems = [];
    const t0 = Date.now();

    for (let i = 0; i < nunotas.length; i += BATCH_SIZE) {
      const batch = nunotas.slice(i, i + BATCH_SIZE);
      const inClause = batch.join(',');

      const sql = `SELECT ITE.NUNOTA, ITE.CODPROD, ITE.QTDNEG, ITE.VLRTOT
        FROM TGFITE ITE
        WHERE ITE.NUNOTA IN (${inClause})`;

      try {
        const result = await this.executeSQL(sql);
        const rows = result.rows || [];
        const mapped = rows.map(row => ({
          nunota: String(row[0]),
          codprod: String(row[1]),
          qtdneg: parseFloat(row[2] || 0),
          vlrtot: parseFloat(row[3] || 0),
        }));
        allItems = allItems.concat(mapped);
      } catch (err) {
        console.error(`Error fetching items SQL batch ${i}:`, err.message);
        // Fallback to CRUD for this batch
        const crudItems = await this._getSalesItemsByNunotasCRUD(batch);
        allItems = allItems.concat(crudItems);
      }
    }

    console.log(`Sales items fetched: ${allItems.length} via SQL in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return allItems;
  }

  /**
   * Fallback: Get sales items via CRUD pagination (slower).
   */
  async _getSalesItemsByNunotasCRUD(nunotas) {
    const BATCH_SIZE = 100;
    let allItems = [];

    for (let i = 0; i < nunotas.length; i += BATCH_SIZE) {
      const batch = nunotas.slice(i, i + BATCH_SIZE);
      const inClause = batch.join(',');

      let page = 0;
      while (true) {
        const body = {
          dataSet: {
            rootEntity: "ItemNota",
            includePresentationFields: "S",
            offsetPage: String(page),
            criteria: {
              expression: { "$": `NUNOTA IN (${inClause})` }
            },
            entity: {
              fieldset: {
                list: "NUNOTA,CODPROD,QTDNEG,VLRTOT"
              }
            }
          }
        };

        try {
          const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
          const entities = response.responseBody?.entities?.entity;
          if (!entities) break;

          const list = Array.isArray(entities) ? entities : [entities];
          if (list.length === 0) break;

          const mapped = list.map(item => ({
            nunota: item.f0?.['$'] || item.NUNOTA?.['$'] || item.NUNOTA,
            codprod: item.f1?.['$'] || item.CODPROD?.['$'] || item.CODPROD,
            qtdneg: parseFloat(item.f2?.['$'] || item.QTDNEG?.['$'] || item.QTDNEG || 0),
            vlrtot: parseFloat(item.f3?.['$'] || item.VLRTOT?.['$'] || item.VLRTOT || 0),
          }));
          allItems = allItems.concat(mapped);
          page++;
        } catch (err) {
          console.error(`Error fetching items CRUD batch ${i}, page ${page}:`, err.message);
          break;
        }
      }
    }

    return allItems;
  }

  /**
   * Get list of active vendors.
   */
  async getVendorList() {
    try {
      let allVendors = [];
      let page = 0;

      while (true) {
        const body = {
          dataSet: {
            rootEntity: "Vendedor",
            includePresentationFields: "S",
            offsetPage: String(page),
            criteria: {
              expression: { "$": "ATIVO = 'S'" }
            },
            entity: {
              fieldset: {
                list: "CODVEND,APELIDO"
              }
            }
          }
        };

        const response = await this.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;
        if (!entities) break;

        const list = Array.isArray(entities) ? entities : [entities];
        if (list.length === 0) break;

        const mapped = list.map(v => ({
          codvend: v.f0?.['$'] || v.CODVEND?.['$'] || v.CODVEND,
          apelido: v.f1?.['$'] || v.APELIDO?.['$'] || v.APELIDO || `Vendedor ${v.f0?.['$'] || v.CODVEND?.['$']}`,
        }));
        allVendors = allVendors.concat(mapped);
        page++;

        // Safety limit to prevent infinite loops
        if (page > 20) break;
      }

      return allVendors;
    } catch (err) {
      console.error('Error fetching vendor list:', err.message);
      return [];
    }
  }

  /**
   * Resolve a search term (code or reference) to a single product.
   * @param {string} term - CODPROD or REFERENCIA
   * @returns {Promise<{codprod: string, descricao: string, referencia: string} | null>}
   */
  async findProduct(term) {
    try {
      const safe = this._sanitize(term);
      const isNumeric = this._isNumericId(term);
      const conditions = [
        `REFERENCIA = '${safe}'`,
        `DESCRPROD LIKE '%${safe}%'`,
        `MARCA LIKE '%${safe}%'`
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
  /**
   * Execute raw SQL via DbExplorerSP.executeQuery.
   * Returns array of row arrays + fieldsMetadata.
   */
  async executeSQL(sql) {
    const resp = await this.callService('DbExplorerSP.executeQuery', { sql }, 'mge');
    return {
      fields: resp.responseBody?.fieldsMetadata || [],
      rows: resp.responseBody?.rows || [],
    };
  }

  /**
   * Get top 10 most sold and least sold ASX products (last 6 months) with stock.
   */
  async getTopProductsASX() {
    // Top por quantidade vendida no mes atual
    const topByQtySQL = `SELECT * FROM (
      SELECT ITE.CODPROD, PRO.DESCRPROD, PRO.REFERENCIA,
        SUM(ITE.QTDNEG) AS QTDTOTAL,
        ROUND(SUM(ITE.VLRTOT), 2) AS VLRTOTAL,
        NVL((SELECT SUM(EST.ESTOQUE) FROM TGFEST EST WHERE EST.CODPROD = ITE.CODPROD AND EST.CODLOCAL NOT IN (9901001, 9901002, 9901003, 9901007, 9902002)), 0) AS ESTOQUE,
        PRO.REFFORN
      FROM TGFITE ITE
      INNER JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
      INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
      WHERE CAB.STATUSNOTA = 'L' AND CAB.CODTIPOPER IN (1971,1972,1974,1975,1976,1978,1979,1982)
        AND CAB.DTNEG >= TRUNC(SYSDATE, 'MM')
        AND PRO.CODGRUPOPROD LIKE '9901%'
      GROUP BY ITE.CODPROD, PRO.DESCRPROD, PRO.REFERENCIA, PRO.REFFORN
      ORDER BY QTDTOTAL DESC
    ) WHERE ROWNUM <= 10`;

    // Top por valor vendido no mes atual
    const topByValueSQL = `SELECT * FROM (
      SELECT ITE.CODPROD, PRO.DESCRPROD, PRO.REFERENCIA,
        SUM(ITE.QTDNEG) AS QTDTOTAL,
        ROUND(SUM(ITE.VLRTOT), 2) AS VLRTOTAL,
        NVL((SELECT SUM(EST.ESTOQUE) FROM TGFEST EST WHERE EST.CODPROD = ITE.CODPROD AND EST.CODLOCAL NOT IN (9901001, 9901002, 9901003, 9901007, 9902002)), 0) AS ESTOQUE,
        PRO.REFFORN
      FROM TGFITE ITE
      INNER JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
      INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
      WHERE CAB.STATUSNOTA = 'L' AND CAB.CODTIPOPER IN (1971,1972,1974,1975,1976,1978,1979,1982)
        AND CAB.DTNEG >= TRUNC(SYSDATE, 'MM')
        AND PRO.CODGRUPOPROD LIKE '9901%'
      GROUP BY ITE.CODPROD, PRO.DESCRPROD, PRO.REFERENCIA, PRO.REFFORN
      ORDER BY VLRTOTAL DESC
    ) WHERE ROWNUM <= 10`;

    const [topQtyResult, topValueResult] = await Promise.all([
      this.executeSQL(topByQtySQL),
      this.executeSQL(topByValueSQL),
    ]);

    const mapRow = (row) => ({
      codprod: String(row[0]),
      descrprod: row[1] || '',
      referencia: row[2] || '',
      qtdTotal: row[3] || 0,
      vlrTotal: row[4] || 0,
      stock: row[5] || 0,
      refforn: row[6] || '',
    });

    return {
      topByQty: topQtyResult.rows.map(mapRow),
      topByValue: topValueResult.rows.map(mapRow),
    };
  }
  /**
   * Get ALL active ASX/ABSOLUX products with stock via SQL.
   * Returns array of { codprod, descrprod, referencia, marca, refforn, codgrupoprod, codparcforn, stock }.
   */
  async getAllActiveResaleProducts() {
    const sql = `SELECT PRO.CODPROD, PRO.DESCRPROD, PRO.REFERENCIA, PRO.MARCA, PRO.REFFORN,
      PRO.CODGRUPOPROD, PRO.CODPARCFORN,
      NVL((SELECT SUM(EST.ESTOQUE) FROM TGFEST EST
            WHERE EST.CODPROD = PRO.CODPROD
            AND EST.CODLOCAL NOT IN (9901001, 9901002, 9901003, 9901007, 9902002)), 0) AS ESTOQUE
    FROM TGFPRO PRO
    WHERE PRO.ATIVO = 'S'
      AND (PRO.CODGRUPOPROD LIKE '9901%' OR PRO.CODGRUPOPROD LIKE '9902%' OR PRO.CODGRUPOPROD LIKE '70%' OR PRO.REFERENCIA LIKE 'ASX%')
    ORDER BY PRO.CODPROD`;

    const result = await this.executeSQL(sql);
    return result.rows.map(row => ({
      codprod: String(row[0]),
      descrprod: row[1] || '',
      referencia: row[2] || '',
      marca: row[3] || '',
      refforn: row[4] || '',
      codgrupoprod: String(row[5] || ''),
      codparcforn: String(row[6] || '0'),
      stock: row[7] || 0,
    }));
  }
}

module.exports = new SankhyaService();
