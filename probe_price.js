const sankhyaService = require('./sankhyaService');

async function probePrice() {
    try {
        await sankhyaService.login();
        console.log('🔍 Probing ExcecaoPreco...');

        const body = {
            dataSet: {
                rootEntity: "ExcecaoPreco",
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: {
                    expression: "1=1" // Try to get anything
                },
                entity: {
                    fieldset: {
                        list: "CODPROD,NUTAB,VLRVENDA"
                    }
                }
            }
        };

        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        console.log(JSON.stringify(response, null, 2));

    } catch (e) {
        console.error(e);
    }
}

probePrice();
