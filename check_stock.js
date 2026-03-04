const sankhyaService = require('./sankhyaService');

/**
 * Script to search for products and check their stock.
 * Usage: node check_stock.js "search term"
 */
async function checkStock() {
    const searchTerm = process.argv[2];

    if (!searchTerm) {
        console.log('❌ Por favor, forneça um termo de busca.');
        console.log('Exemplo: node check_stock.js "LUMINARIA"');
        process.exit(1);
    }

    console.log(`\n🔍 Buscando produtos com termo: "${searchTerm}"...\n`);

    try {
        await sankhyaService.login();

        // Split search term into words to allow flexible search (e.g. "lampada h7" -> "lampada" AND "h7")
        const terms = searchTerm.toUpperCase().split(/\s+/).filter(t => t.length > 0);

        // Create AND condition for each term
        // DESCRPROD LIKE '%TERM1%' AND DESCRPROD LIKE '%TERM2%' ...
        const termConditions = terms.map(term => `DESCRPROD LIKE '%${term}%'`).join(' AND ');

        const where = `(${termConditions}) AND ATIVO = 'S'`;

        const body = {
            dataSet: {
                rootEntity: "Produto",
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: {
                    expression: { "$": where }
                },
                entity: {
                    fieldset: {
                        list: "CODPROD,DESCRPROD,REFERENCIA"
                    }
                }
            }
        };

        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        if (!entities || (Array.isArray(entities) && entities.length === 0)) {
            console.log('⚠️  Nenhum produto encontrado.');
            return;
        }

        const list = Array.isArray(entities) ? entities : [entities];
        // Limit to 5 results to avoid flooding if search is too broad, but enough to be useful
        const limitedList = list.slice(0, 5);

        console.log(`✅ Encontrados ${list.length} produtos. Exibindo os primeiros ${limitedList.length}:\n`);
        console.log('--------------------------------------------------------------------------------');

        for (const product of limitedList) {
            const codProd = product.f0?.['$'] || product.CODPROD?.['$'] || product.CODPROD;
            const descrProd = product.f1?.['$'] || product.DESCRPROD?.['$'] || product.DESCRPROD;
            const referencia = product.f2?.['$'] || product.REFERENCIA?.['$'] || product.REFERENCIA || '-';

            // Fetch stock for this product
            process.stdout.write(`⏳ Verificando estoque para ${codProd}... `);
            const stock = await sankhyaService.getProductStockREST(codProd);
            process.stdout.write(`Done.\n`);

            // Fetch price just for completeness (optional, but useful)
            // const price = await sankhyaService.getProductPrice(codProd);

            console.log(`📦 Produto: ${descrProd}`);
            console.log(`   Código: ${codProd} | Ref: ${referencia}`);
            console.log(`   📊 Estoque Disponível: ${stock} un.`);
            console.log('--------------------------------------------------------------------------------');
        }

    } catch (error) {
        console.error('\n❌ Erro ao buscar produtos:', error.message);
    }
}

checkStock();
