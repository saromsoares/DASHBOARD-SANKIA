const sankhyaService = require('./sankhyaService');

/**
 * Script to test fetching product price by code via REST API.
 * Usage: node test_price_by_code.js <CODPROD> [NUTAB]
 * Example: node test_price_by_code.js 397 6
 */
async function testProductPrice() {
    const codProd = process.argv[2];
    const nutab = process.argv[3] || 6; // Default to 6 as requested

    if (!codProd) {
        console.log('❌ Por favor, forneça o código do produto.');
        console.log('Exemplo: node test_price_by_code.js 397 6');
        process.exit(1);
    }

    console.log(`\n🔍 Buscando preço (REST API) para o produto "${codProd}" na Tabela ${nutab}...\n`);

    try {
        await sankhyaService.login();

        // 1. Get Product Description
        const descMap = await sankhyaService.getProductDescriptions([codProd]);
        const description = descMap[codProd] || "Descrição não encontrada";

        console.log(`📦 Produto: ${description} (Cód: ${codProd})`);

        // 2. Get Price
        process.stdout.write(`⏳ Buscando preço na Tabela ${nutab}... `);

        // Pass the table number to the service
        const price = await sankhyaService.getProductPriceREST(codProd, nutab);
        process.stdout.write(`Done.\n`);

        console.log(`💰 Preço Encontrado: R$ ${price}`);

    } catch (error) {
        console.error('\n❌ Erro ao buscar preço:', error.message);
    }
}

testProductPrice();
