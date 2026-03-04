const sankhyaService = require('./sankhyaService');
const fs = require('fs');

async function listAllProducts(term) {
    console.log(`🔎 Searching form ALL products with term: "${term}"`);
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
                entity: { fieldset: { list: "CODPROD,DESCRPROD,REFERENCIA,ATIVO" } } // Should include ATIVO? yes
            }
        };

        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        let outputText = `Resultados para "${term}":\n\n`;

        if (!entities || (Array.isArray(entities) && entities.length === 0)) {
            const msg = "❌ Nenhum produto encontrado.";
            console.log(msg);
            outputText += msg;
            fs.writeFileSync('h1_products_utf8.txt', outputText, 'utf8');
            return;
        }

        const list = Array.isArray(entities) ? entities : [entities];
        console.log(`✅ Encontrados total de ${list.length} produtos (mostrando top 100).\n`);
        outputText += `Encontrados total de ${list.length} produtos (mostrando top 100).\n\n`;

        let count = 0;
        for (const p of list) {
            if (count >= 100) break;
            const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
            const desc = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;
            const ref = p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA || '-';

            const line = `• ${desc} (Cód: ${cod} | Ref: ${ref})`;
            // console.log(line); // Skip console log to avoid buffer issues
            outputText += line + '\n';
            count++;
        }

        if (list.length > 100) {
            const more = `\n... e mais ${list.length - 100} produtos.`;
            // console.log(more);
            outputText += more;
        }

        fs.writeFileSync('h1_products_utf8.txt', outputText, 'utf8');
        console.log("Written to h1_products_utf8.txt");

    } catch (error) {
        console.error("Erro:", error.message);
    }
}

const term = process.argv[2];
if (term) {
    listAllProducts(term);
} else {
    console.log("Usage: node list_all_products_by_term.js <term>");
}
