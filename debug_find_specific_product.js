const sankhyaService = require('./sankhyaService');

async function runSearch(term, label) {
    console.log(`\n🔎 [${label}] Searching for: "${term}"`);
    console.log('------------------------------------------------');

    const where = `this.REFERENCIA LIKE '%${term}%' OR this.CODPROD = '${term}' OR this.DESCRPROD LIKE '%${term}%'`;
    console.log(`   Criteria: ${where}`);

    const body = {
        dataSet: {
            rootEntity: "Produto",
            includePresentationFields: "S",
            offsetPage: "0",
            criteria: {
                expression: {
                    $: where
                }
            },
            entity: {
                fieldset: {
                    list: "CODPROD,DESCRPROD,REFERENCIA,COMPLDESC,MARCA,ATIVO"
                }
            }
        }
    };

    try {
        const result = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = result.responseBody?.entities?.entity;

        if (!entities) {
            console.log(`   ❌ No matches for "${term}".`);
        } else {
            const list = Array.isArray(entities) ? entities : [entities];
            console.log(`   ✅ Found ${list.length} matches:`);

            list.forEach((item, index) => {
                console.log(`      [MATCH #${index + 1}] RAW DATA:`);
                console.log(JSON.stringify(item, null, 2));
            });
        }
    } catch (err) {
        console.error("   ❌ Error:", err.message);
    }
}

async function debug() {
    await sankhyaService.login();
    await runSearch("ASX1251", "SAME_CODE_EXAMPLE");
}

debug();
