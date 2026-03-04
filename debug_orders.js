const sankhyaService = require('./sankhyaService');

async function debugOrders() {
    const cnpj = '30409112000161'; // O COROA
    console.log(`🔎 Debugging Orders for CNPJ: ${cnpj} (via Subquery)`);

    try {
        // Find ALL Movements (TGFCAB) using Subquery
        // No TIPMOV filter, just CNPJ subquery
        const where = `this.CODPARC IN (SELECT CODPARC FROM TGFPAR WHERE CGC_CPF = '${cnpj}')`;

        const body = {
            dataSet: {
                rootEntity: "CabecalhoNota",
                offsetPage: "0",
                criteria: { expression: where },
                entity: {
                    fieldset: {
                        list: "NUNOTA,NUMNOTA,DTNEG,TIPMOV"
                    }
                }
            }
        };

        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        if (!entities || (Array.isArray(entities) && entities.length === 0)) {
            console.log("No orders/notes found for this partner.");
            return;
        }

        const list = Array.isArray(entities) ? entities : [entities];

        console.log(`found ${list.length} movements.`);

        // Analyze TIPMAOV types
        const types = {};

        list.forEach(item => {
            const tipmov = item.f3?.['$'] || item.TIPMOV?.['$'] || item.TIPMOV;
            const nunota = item.f0?.['$'] || item.NUNOTA?.['$'] || item.NUNOTA;
            const dtneg = item.f2?.['$'] || item.DTNEG?.['$'] || item.DTNEG;

            if (!types[tipmov]) types[tipmov] = [];
            types[tipmov].push({ nunota, dtneg });
        });

        console.log("Movement Types Found:");
        Object.keys(types).forEach(type => {
            console.log(`- Type '${type}': ${types[type].length} records. (Last: ${types[type][0].dtneg})`);
        });

        // Fetch items from one of each type to see descriptions
        for (const type of Object.keys(types)) {
            const sample = types[type][0];
            console.log(`\nChecking items for Type '${type}' (NUNOTA ${sample.nunota})...`);

            const itemsQuery = {
                dataSet: {
                    rootEntity: "ItemNota",
                    criteria: { expression: `NUNOTA = ${sample.nunota}` },
                    entity: { fieldset: { list: "CODPROD,DESCRPROD" } }
                }
            };

            const iRes = await sankhyaService.callService('CRUDServiceProvider.loadRecords', itemsQuery, 'mge');
            const iEnts = iRes.responseBody?.entities?.entity;
            if (iEnts) {
                const iList = Array.isArray(iEnts) ? iEnts : [iEnts];
                console.log(`Items found: ${iList.length}`);
                iList.slice(0, 3).forEach(it => {
                    const d = it.f1?.['$'] || it.DESCRPROD?.['$'] || it.DESCRPROD || it.Produto?.DESCRPROD || "---";
                    console.log(`   - ${d}`);
                });
            } else {
                console.log("   No items found.");
            }
        }

    } catch (e) {
        console.error("Error Detail:", JSON.stringify(e.response?.data || e.message, null, 2));
    }
}

debugOrders();
