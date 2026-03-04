const sankhyaService = require('./sankhyaService');

async function probeKeyFinal() {
    const nunota = 23534;
    console.log(`🕵️ Buscando Chave NF-e em campos alternativos (NUNOTA ${nunota})...`);

    const body = {
        dataSet: {
            rootEntity: "CabecalhoNota",
            includePresentationFields: "S",
            offsetPage: "0",
            criteria: {
                expression: { "$": "NUNOTA = ?" },
                parameter: [{ "$": String(nunota), "type": "I" }]
            },
            entity: [
                {
                    path: "",
                    fieldset: { list: "NUNOTA,CHAVENFE,AD_CHAVENFE" }
                },
                {
                    path: "NotaFiscalEletronica",
                    fieldset: { list: "CHAVENFE" }
                }
            ]
        }
    };

    try {
        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        if (entities) {
            const list = Array.isArray(entities) ? entities : [entities];
            console.log('✅ Resposta Completa:', JSON.stringify(list[0], null, 2));
        } else {
            console.log('❌ Nada encontrado.');
        }
    } catch (error) {
        console.log('❌ Erro:', error.message);
        // Check if it's a persistence error (Join blocked?)
    }
}

probeKeyFinal();
