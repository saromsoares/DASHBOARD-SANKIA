const sankhyaService = require('./sankhyaService');

/**
 * Probe script to find the correct item entity name
 */

async function probeItems() {
    const entitiesToTest = ['ItemNota', 'Item', 'TGFITE', 'Itens'];
    const nunota = 23534;

    console.log(`🕵️ Iniciando sonda de ITENS para NUNOTA ${nunota}...\n`);

    for (const entity of entitiesToTest) {
        console.log(`\n🧪 Testando entidade: ${entity}`);

        const body = {
            dataSet: {
                rootEntity: entity,
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: {
                    expression: { "$": "NUNOTA = ?" },
                    parameter: [{ "$": String(nunota), "type": "I" }]
                },
                entity: {
                    fieldset: {
                        list: "SEQUENCIA,CODPROD" // Minimal fields
                    }
                }
            }
        };

        try {
            const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');

            const entities = response.responseBody?.entities?.entity;

            if (entities) {
                const list = Array.isArray(entities) ? entities : [entities];
                console.log(`✅ SUCESSO com '${entity}'! Encontrou ${list.length} itens.`);
            } else {
                console.log(`⚠️  Resposta vazia com '${entity}' (mas sem erro de persistência).`);
            }

        } catch (error) {
            console.log(`❌ FALHA com '${entity}': ${error.message}`);
        }
    }
}

probeItems();
