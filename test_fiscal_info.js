const sankhyaService = require('./sankhyaService');

/**
 * Test script for fiscal information retrieval
 * 
 * Usage:
 *   node test_fiscal_info.js [NUMERO_NOTA]
 * 
 * Example:
 *   node test_fiscal_info.js 123456
 */

async function testFiscalInfo() {
    try {
        // Get note number from command line argument
        const noteNumber = process.argv[2];

        if (!noteNumber) {
            console.log('❌ Por favor, forneça um número de nota como argumento.');
            console.log('Uso: node test_fiscal_info.js [NUMERO_NOTA]');
            console.log('Exemplo: node test_fiscal_info.js 123456');
            process.exit(1);
        }

        console.log('🔐 Iniciando testes de consulta fiscal...\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Test 1: Get fiscal information
        console.log('📋 Teste 1: Buscar informações fiscais da nota');
        console.log(`Buscando nota: ${noteNumber}\n`);

        const fiscalInfo = await sankhyaService.getOrderFiscalInfo(noteNumber);

        if (fiscalInfo.success) {
            console.log('✅ Sucesso!');
            console.log(fiscalInfo.message);
            console.log('\n📊 Dados detalhados:');
            console.log(JSON.stringify(fiscalInfo.data, null, 2));

            // Test 2: Get items from the invoice
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('📦 Teste 2: Buscar produtos/itens da nota');
            console.log(`Buscando itens do NUNOTA: ${fiscalInfo.data.nunota}\n`);

            const orderItems = await sankhyaService.getOrderItems(fiscalInfo.data.nunota);

            if (orderItems.success) {
                console.log('✅ Sucesso!');
                console.log(orderItems.message);
                console.log('\n📊 Dados detalhados:');
                console.log(JSON.stringify(orderItems.data, null, 2));
            } else {
                console.log('❌ Erro ao buscar itens:');
                console.log(orderItems.message);
            }
        } else {
            console.log('❌ Erro ao buscar informações fiscais:');
            console.log(fiscalInfo.message);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✨ Testes concluídos!\n');

    } catch (error) {
        console.error('❌ Erro durante os testes:', error.message);
        if (error.response) {
            console.error('Detalhes:', error.response.data);
        }
        process.exit(1);
    }
}

// Run tests
testFiscalInfo();
