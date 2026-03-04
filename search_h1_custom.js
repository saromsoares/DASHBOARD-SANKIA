const sankhyaService = require('./sankhyaService');

async function searchH1Custom() {
    try {
        console.log('🔎 Searching for products with "H1" AND ("10.000" or "10000")...');

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
            // Must have H1 (guaranteed by query) AND (10000 or 10.000)
            // AND verify H1 is separate word or part of specific code to avoid H11/H16
            // Actually user just asked "H1 e 10000".
            // Simple check:
            return (desc.includes('10000') || desc.includes('10.000'));
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

searchH1Custom();
