const sankhyaService = require('./sankhyaService');

/**
 * Test script to list all products
 * This will test authentication and basic product listing
 */

async function testListProducts() {
    try {
        console.log('🔐 Iniciando teste de listagem de produtos...\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Force authentication first
        console.log('🔑 Step 1: Autenticando...');
        await sankhyaService.login();
        console.log('✅ Autenticação bem-sucedida!\n');

        // List products
        console.log('📦 Step 2: Buscando lista de produtos...\n');

        const body = {
            dataSet: {
                rootEntity: "Produto", // TGFPRO
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: {
                    expression: "ATIVO = 'S'" // Only active products
                },
                entity: {
                    fieldset: {
                        list: "CODPROD,DESCRPROD,REFERENCIA,ATIVO"
                    }
                }
            }
        };

        console.log('📋 Consultando produtos ativos...');
        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');

        console.log('\n✅ Resposta recebida!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Parse results
        const entities = response.responseBody?.entities?.entity;

        if (!entities || (Array.isArray(entities) && entities.length === 0)) {
            console.log('⚠️  Nenhum produto encontrado.');
            return;
        }

        const list = Array.isArray(entities) ? entities : [entities];
        console.log(`📊 Total de produtos encontrados: ${list.length}\n`);

        // Display first 10 products
        console.log('🔝 Primeiros produtos:\n');
        list.slice(0, 10).forEach((produto, index) => {
            const codProd = produto.f0?.['$'] || produto.CODPROD?.['$'] || produto.CODPROD;
            const descrProd = produto.f1?.['$'] || produto.DESCRPROD?.['$'] || produto.DESCRPROD;
            const referencia = produto.f2?.['$'] || produto.REFERENCIA?.['$'] || produto.REFERENCIA || 'N/A';
            const ativo = produto.f3?.['$'] || produto.ATIVO?.['$'] || produto.ATIVO;

            console.log(`${index + 1}. [${codProd}] ${descrProd}`);
            console.log(`   Referência: ${referencia} | Ativo: ${ativo}\n`);
        });

        if (list.length > 10) {
            console.log(`... e mais ${list.length - 10} produtos.\n`);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✨ Teste concluído com sucesso!\n');

    } catch (error) {
        console.error('\n❌ Erro durante o teste:', error.message);
        if (error.response) {
            console.error('\n📋 Detalhes da resposta:');
            console.error(JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

// Run test
testListProducts();
