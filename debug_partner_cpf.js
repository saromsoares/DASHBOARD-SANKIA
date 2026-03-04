const sankhyaService = require('./sankhyaService');

/**
 * Debug script to find Partner by CPF/CNPJ
 * 
 * Usage:
 *   node debug_partner_cpf.js [CPF_OR_CNPJ]
 */

async function findPartner() {
    try {
        const identifier = process.argv[2];

        if (!identifier) {
            console.log('❌ Por favor, forneça um CPF ou CNPJ como argumento.');
            process.exit(1);
        }

        const cleanId = identifier.replace(/\D/g, '');
        console.log(`🔎 Buscando parceiro com CPF/CNPJ: ${cleanId} ...\n`);

        const body = {
            dataSet: {
                rootEntity: "Parceiro", // TGFPAR
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: {
                    expression: { "$": `CGC_CPF = '${cleanId}'` }
                },
                entity: {
                    fieldset: {
                        list: "CODPARC,NOMEPARC,RAZAOSOCIAL"
                    }
                }
            }
        };

        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        if (!entities || (Array.isArray(entities) && entities.length === 0)) {
            console.log(`❌ Nenhum parceiro encontrado com o documento ${cleanId}.`);
        } else {
            const list = Array.isArray(entities) ? entities : [entities];
            console.log(`✅ Encontrado(s) ${list.length} parceiro(s):\n`);

            list.forEach(p => {
                const cod = p.f0?.['$'] || p.CODPARC?.['$'] || p.CODPARC;
                const nome = p.f1?.['$'] || p.NOMEPARC?.['$'] || p.NOMEPARC;
                const razao = p.f2?.['$'] || p.RAZAOSOCIAL?.['$'] || p.RAZAOSOCIAL;

                console.log(`🆔 Código: ${cod}`);
                console.log(`👤 Nome: ${nome}`);
                console.log(`🏢 Razão Social: ${razao}`);
                console.log('-----------------------------------');
            });
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.response) console.error('Detalhes:', error.response.data);
    }
}

findPartner();
