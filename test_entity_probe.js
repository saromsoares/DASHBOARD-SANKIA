const sankhyaService = require('./sankhyaService');

/**
 * Probe script to find the correct criteria syntax
 */

async function probeCriteria() {
    const entity = 'CabecalhoNota';
    const nunota = 23534;

    console.log(`🕵️ Iniciando sonda de critérios para ${entity}...\n`);

    const tests = [
        { name: 'Simple String', expression: `NUNOTA = ${nunota}` },
        { name: 'This Alias', expression: `this.NUNOTA = ${nunota}` },
        { name: 'PK Syntax', expression: `PK = ${nunota}` }, // Sometimes PK works
        {
            name: 'With Parameters',
            criteria: {
                expression: { "$": "NUNOTA = ?" },
                parameter: [{ "$": String(nunota), "type": "I" }]
            }
        }
    ];

    for (const t of tests) {
        console.log(`\n🧪 Testando: ${t.name}`);

        const body = {
            dataSet: {
                rootEntity: entity,
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: t.criteria || { expression: t.expression },
                entity: {
                    fieldset: {
                        list: "NUNOTA"
                    }
                }
            }
        };

        try {
            const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');

            const entities = response.responseBody?.entities?.entity;
            if (!entities) {
                console.log(`⚠️  Sem resultados.`);
                continue;
            }

            const list = Array.isArray(entities) ? entities : [entities];
            const first = list[0];
            const foundNunota = first.f0?.['$'] || first.NUNOTA?.['$'] || first.NUNOTA;

            console.log(`✅ Retornou ${list.length} registro(s). Primeiro NUNOTA: ${foundNunota}`);

            if (foundNunota == nunota) {
                console.log(`🎉 SUCCESSO! Encontrou o registro correto!`);
            } else {
                console.log(`❌ ERRO: Veio registro errado (NUNOTA ${foundNunota})`);
            }

        } catch (error) {
            console.log(`❌ FALHA: ${error.message}`);
        }
    }
}

probeCriteria();
