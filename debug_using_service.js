const sankhyaService = require('./sankhyaService');

async function debug() {
    console.log("🛠️  Debugging with sankhyaService.findProduct()...");

    const codes = ["ASX1001", "ASX1251", "ASX1003"];

    for (const code of codes) {
        console.log(`\n🔍 Searching for: ${code}`);
        try {
            const product = await sankhyaService.findProduct(code);
            if (product) {
                console.log(`✅ FOUND:`);
                console.log(JSON.stringify(product, null, 2));
            } else {
                console.log(`❌ NOT FOUND (findProduct returned null)`);
            }
        } catch (error) {
            console.error(`⚠️  ERROR: ${error.message}`);
        }
    }

    console.log('\n🔎 Checking customized search for ASX1003 (ignoring ATIVO=S)...');
    try {
        const where = `(this.CODVOL = 'ASX1003' OR this.REFERENCIA = 'ASX1003')`;
        const body = {
            dataSet: {
                rootEntity: "Produto",
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: {
                    expression: { $: where }
                },
                entity: {
                    fieldset: {
                        list: "CODPROD,DESCRPROD,REFERENCIA,ATIVO"
                    }
                }
            }
        };
        const result = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = result.responseBody?.entities?.entity;
        if (entities) {
            console.log("✅ FOUND INACTIVE OR OTHER:");
            console.log(JSON.stringify(entities, null, 2));
        } else {
            console.log("❌ STRICTLY NOT FOUND (even inactive)");
        }
    } catch (err) {
        console.error(err.message);
    }
}

debug();
