const sankhyaService = require('./sankhyaService');

async function searchH1StrictAll() {
    let allMatches = [];
    let offsetPage = 0;
    let hasMore = true;

    console.log('🔎 Searching for products with STRICT "H1" AND ("10.000" or "10000") across ALL pages...');

    try {
        while (hasMore) {
            console.log(`📡 Fetching page ${offsetPage}...`);
            const where = `DESCRPROD LIKE '%H1%' AND ATIVO = 'S'`;

            const body = {
                dataSet: {
                    rootEntity: "Produto",
                    includePresentationFields: "S",
                    offsetPage: offsetPage.toString(),
                    criteria: { expression: { "$": where } },
                    entity: { fieldset: { list: "CODPROD,DESCRPROD,REFERENCIA" } }
                }
            };

            const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
            const entities = response.responseBody?.entities?.entity;

            if (!entities) {
                hasMore = false;
                break;
            }

            const list = Array.isArray(entities) ? entities : [entities];

            // Filter in JS
            const matches = list.filter(p => {
                const desc = (p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD || '').toUpperCase();

                // Strict H1 check: 
                // Using \bH1\b ensures "H1" is not part of "H11", "H13", etc.
                const hasH1 = /\bH1\b/.test(desc);

                const has10000 = (desc.includes('10000') || desc.includes('10.000'));

                return hasH1 && has10000;
            });

            allMatches = allMatches.concat(matches);

            // Check if we hit the end (usually based on entities.total or if we got fewer than 50)
            const total = parseInt(response.responseBody?.entities?.total || "0");
            if ((offsetPage + 1) * 50 >= total || list.length < 50) {
                hasMore = false;
            } else {
                offsetPage++;
            }
        }

        console.log(`\n✅ Found ${allMatches.length} matching products:`);
        allMatches.forEach(p => {
            const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
            const desc = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;
            const ref = p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA || '-';
            console.log(`[${cod}] ${desc} (Ref: ${ref})`);
        });

    } catch (error) {
        console.error("❌ Error during search:", error.message);
    }
}

searchH1StrictAll();
