const sankhyaService = require('./sankhyaService');

/**
 * Test script for order retrieval by CPF/CNPJ
 * 
 * Usage:
 *   node test_orders_by_customer.js [CPF_OR_CNPJ]
 * 
 * Example:
 *   node test_orders_by_customer.js 12345678900
 */

async function testOrderRetrieval() {
    try {
        // Get CPF/CNPJ from command line argument
        const identifier = process.argv[2];

        if (!identifier) {
            console.log('❌ Por favor, forneça um CPF ou CNPJ como argumento.');
            console.log('Uso: node test_orders_by_customer.js [CPF_OU_CNPJ]');
            console.log('Exemplo: node test_orders_by_customer.js 11122233344');
            process.exit(1);
        }

        console.log('🔐 Iniciando testes de consulta de pedidos...\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log(`📋 Buscando pedidos para o documento: ${identifier}`);

        const result = await sankhyaService.getOrdersByCpfCnpj(identifier);

        if (result.success) {
            console.log('✅ Sucesso!');
            console.log(result.message);

            if (result.data && result.data.length > 0) {
                console.log('\n📊 Detalhes dos pedidos encontrados:');
                console.log(JSON.stringify(result.data, null, 2));
            }
        } else {
            console.log('❌ Erro na consulta:');
            console.log(result.message);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✨ Teste concluído!\n');

    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
        if (error.response) {
            console.error('Detalhes:', error.response.data);
        }
        process.exit(1);
    }
}

// Run test
testOrderRetrieval();
