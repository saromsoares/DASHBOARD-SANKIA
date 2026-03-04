const sankhyaService = require('./sankhyaService');
const fs = require('fs');

async function listProductsWithPrice(term) {
    console.log(`🔎 Searching products with price for term: "${term}"`);
    try {
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
        console.log(`✅ Encontrados ${list.length} produtos. Buscando preços...`);

        const limit = 50;
        const limitedList = list.slice(0, limit);

        // Fetch info in parallel
        const results = await Promise.all(limitedList.map(async (p) => {
            const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
            const desc = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;
            const ref = p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA || '-';

            // Fetch price (Table 6 seems to be the standard from previous turns)
            const price = await sankhyaService.getProductPriceREST(cod, 6);

            return { cod, desc, ref, price };
        }));

        let outputText = `Resultados para "${term}" com preços:\n\n`;

        results.forEach(item => {
            const line = `• ${item.desc} (Ref: ${item.ref})\n  Cód: ${item.cod} | Preço: R$ ${item.price}`;
            outputText += line + '\n\n';
        });

        if (list.length > limit) {
            outputText += `... e mais ${list.length - limit} produtos não listados.`;
        }

        const filename = `search_${term.replace(/[^a-zA-Z0-9]/g, '_')}_prices.txt`;
        fs.writeFileSync(filename, outputText, 'utf8');
        console.log(`✅ Resultados salvos em ${filename}`);

    } catch (error) {
        console.error("Erro:", error.message);
    }
}

const term = process.argv[2];
if (term) {
    listProductsWithPrice(term);
} else {
    console.log("Usage: node search_with_price.js <term>");
}
