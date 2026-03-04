const sankhyaService = require('./sankhyaService');

async function searchH1Broad() {
    try {
        console.log('🔎 Searching for products with "H1" AND ("10.000" or "10000")...');

        // Broad search for H1
        const where = `DESCRPROD LIKE '%H1%' AND ATIVO = 'S'`;

        const body = {
            dataSet: {
                rootEntity: "Produto",
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: { expression: { "$": where } },
                entity: { fieldset: { list: "CODPROD,DESCRPROD,REFERENCIA,ATIVO" } }
            }
        };

        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        if (!entities) {
            console.log("❌ No products found.");
            return;
        }

        const list = Array.isArray(entities) ? entities : [entities];

        // Broader filter: Must have H1 AND 10000/10.000
        const matches = list.filter(p => {
            const desc = (p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD || '').toUpperCase();
            return desc.includes('H1') && (desc.includes('10000') || desc.includes('10.000'));
        });

        console.log(`✅ Found ${matches.length} matching products:`);
        matches.forEach(p => {
            const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
            const desc = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;
            const ref = p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA || '-';
            console.log(`[${cod}] ${desc} (Ref: ${ref})`);
        });

    } catch (error) {
        console.error("Error:", error.message);
    }
}

searchH1Broad();
