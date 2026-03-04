const sankhyaService = require('./sankhyaService');

async function searchProduct(term) {
    console.log(`🔎 Searching for: "${term}"`);
    try {
        // We use the same getProductInfo logic but return raw array if possible, 
        // or just print the message cleanly.
        // sankhyaService.getProductInfo returns a formatted string. 
        // Let's implement a direct search here to get raw data.

        const terms = term.toUpperCase().split(/\s+/).filter(t => t.length > 0);
        const termConditions = terms.map(t => {
            const isNumeric = /^\d+$/.test(t);
            const conditions = [
                `DESCRPROD LIKE '%${t}%'`,
                `REFERENCIA LIKE '%${t}%'`,
                `MARCA LIKE '%${t}%'`
            ];
            if (isNumeric) conditions.push(`CODPROD = ${t}`);
            return `(${conditions.join(' OR ')})`;
        }).join(' AND ');

        const where = `(${termConditions}) AND ATIVO = 'S'`;

        const body = {
            dataSet: {
                rootEntity: "Produto",
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: { expression: { "$": where } },
                entity: { fieldset: { list: "CODPROD,DESCRPROD,REFERENCIA" } }
            }
        };

        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        if (!entities || (Array.isArray(entities) && entities.length === 0)) {
            console.log("❌ Nenhum produto encontrado.");
            return;
        }

        const list = Array.isArray(entities) ? entities : [entities];
        console.log(`✅ Encontrados ${list.length} produtos.`);

        for (const p of list.slice(0, 10)) { // Limit to 10
            const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
            const desc = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;
            const ref = p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA || '-';

            // Fetch price/stock? Maybe just basic info first.
            console.log(`[${cod}] ${desc} (Ref: ${ref})`);
        }

    } catch (error) {
        console.error("Erro:", error.message);
    }
}

const term = process.argv[2];
if (term) {
    searchProduct(term);
} else {
    console.log("Usage: node search_product_clean.js <term>");
}
