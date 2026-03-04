const sankhyaService = require('./sankhyaService');

async function searchH1Strict() {
    try {
        console.log('🔎 Searching for products with STRICT "H1" AND ("10.000" or "10000")...');

        // Broad search for H1 first
        const where = `DESCRPROD LIKE '%H1%' AND ATIVO = 'S'`;

        const body = {
            dataSet: {
                rootEntity: "Produto",
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: { expression: { "$": where } },
                entity: { fieldset: { list: "CODPROD,DESCRPROD" } }
            }
        };

        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        if (!entities) {
            console.log("❌ No products found.");
            return;
        }

        const list = Array.isArray(entities) ? entities : [entities];

        // Filter in JS
        const matches = list.filter(p => {
            const desc = (p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD || '').toUpperCase();

            // Strict H1 check: 
            // 1. " H1 " (surrounded by spaces)
            // 2. "H1 " (at start)
            // 3. " H1" (at end)
            // 4. "H1" (exact match)
            // Easier with regex:
            const hasH1 = /\bH1\b/.test(desc);

            const has10000 = (desc.includes('10000') || desc.includes('10.000'));

            return hasH1 && has10000;
        });

        console.log(`✅ Found ${matches.length} matching products:`);
        matches.forEach(p => {
            const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
            const desc = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;
            console.log(`[${cod}] ${desc}`);
        });

    } catch (error) {
        console.error("Error:", error.message);
    }
}

searchH1Strict();
