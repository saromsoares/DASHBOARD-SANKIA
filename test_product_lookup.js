const sankhyaService = require('./sankhyaService');

/**
 * Test script to lookup product by code
 * usage: node test_product_lookup.js [CODE]
 */

async function testProductLookup() {
    const code = process.argv[2];
    if (!code) {
        console.log("Usage: node test_product_lookup.js [CODE]");
        process.exit(1);
    }

    console.log(`🔎 Buscando produto com código: ${code}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        console.log("--- getProductInfo (Formatted) ---");
        const info = await sankhyaService.getProductInfo(code);
        console.log(info);

        console.log("\n--- findProduct (Structured) ---");
        const product = await sankhyaService.findProduct(code);
        if (product) {
            console.log(JSON.stringify(product, null, 2));
        } else {
            console.log("Produto não encontrado via findProduct.");
        }

    } catch (error) {
        console.error("Erro:", error);
    }
}

testProductLookup();
