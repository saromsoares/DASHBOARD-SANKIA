const sankhyaService = require('./sankhyaService');

async function resolveProductNames() {
    const productCodes = [
        4602, 7148, 7147, 6734, 398, 490,
        1863, 1866, 7576, 115, 4576, 397,
        4590, 225
    ];

    console.log('🔍 Pesquisando nomes dos produtos...\n');

    // Build IN clause for criteria
    const inClause = productCodes.join(',');
    const where = `CODPROD IN (${inClause})`;

    const body = {
        dataSet: {
            rootEntity: "Produto", // TGFPRO
            includePresentationFields: "S",
            offsetPage: "0",
            criteria: {
                // IMPORTANT: Must use object syntax with $ key
                expression: { "$": where }
            },
            entity: {
                fieldset: {
                    list: "CODPROD,DESCRPROD"
                }
            }
        }
    };

    console.log(`Filtro: ${where}`);

    try {
        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        if (!entities) {
            console.log('❌ Nenhum produto encontrado com estes códigos.');
            return;
        }

        const list = Array.isArray(entities) ? entities : [entities];

        console.log(`✅ Encontrados ${list.length} produtos:\n`);
        console.log('Codigo | Descrição');
        console.log('-------|--------------------------------');

        list.forEach(p => {
            const codigo = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
            const descricao = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;

            console.log(`${String(codigo).padEnd(6)} | ${descricao}`);
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.response) console.error(JSON.stringify(error.response.data, null, 2));
    }
}

resolveProductNames();
