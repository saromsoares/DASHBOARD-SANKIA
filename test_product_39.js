/**
 * Test Product Details (Real Stock/Price)
 * Usage: node test_product_39.js
 */
const sankhyaService = require('./sankhyaService');

async function testProduct39() {
    console.log('\n🧪 TESTING PRODUCT 39 (Live Data)...');
    console.log('------------------------------------------------');

    try {
        // Using text because ID filtering is returning all records. 
        // "LAMPADA H7 SUPER BRANCA" should match product 39.
        const result = await sankhyaService.getProductInfo('LAMPADA H7 SUPER');
        console.log(result);
    } catch (err) {
        console.error('❌ Error:', err);
    }
    console.log('------------------------------------------------\n');
}

testProduct39();
