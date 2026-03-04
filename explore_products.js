/**
 * Product Explorer Tool
 * Usage: node explore_products.js [search_term]
 */
const sankhyaService = require('./sankhyaService');

async function listProducts() {
    console.log('\n🔍 EXPLORING SANKHYA PRODUCTS...');
    console.log('------------------------------------------------');

    // Default to 'LAMP' to find lamps as requested, or use command line arg
    const searchTerm = process.argv[2] || 'LAMP';
    console.log(`🎯 Searching for: "${searchTerm}" (ATIVO = 'S')`);

    try {
        await sankhyaService.login();

        // Criteria: Description contains term AND is Active
        const where = `DESCRPROD LIKE '%${searchTerm.toUpperCase()}%' AND ATIVO = 'S'`;

        const body = {
            dataSet: {
                rootEntity: "Produto", // TGFPRO
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: {
                    expression: where
                },
                entity: {
                    fieldset: {
                        list: "CODPROD,DESCRPROD,COMPLDESC,MARCA,REFERENCIA"
                    }
                }
            }
        };

        console.log('⏳ Querying API...');
        const result = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');

        const entities = result.responseBody?.entities?.entity;

        if (!entities) {
            console.log('⚠️  No products found matching criteria.');
        } else {
            const list = Array.isArray(entities) ? entities : [entities];
            console.log(`✅ Found ${list.length} products:\n`);

            console.log('CODPROD | REFERENCIA   | DESCRIÇÃO');
            console.log('--------|--------------|--------------------------------------------');

            list.forEach(item => {
                const cod = (item.f0?.['$'] || item.CODPROD?.['$'] || item.CODPROD || '').padEnd(7);
                const desc = (item.f1?.['$'] || item.DESCRPROD?.['$'] || item.DESCRPROD || '').substring(0, 40);
                const ref = (item.f4?.['$'] || item.REFERENCIA?.['$'] || item.REFERENCIA || '').padEnd(12);

                console.log(`${cod} | ${ref} | ${desc}`);
            });
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        if (err.response) console.log(JSON.stringify(err.response.data, null, 2));
    }
    console.log('------------------------------------------------\n');
}

listProducts();
