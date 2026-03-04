const sankhyaService = require('./sankhyaService');

/**
 * Script to test fetching order/invoice information details.
 * Usage: node test_order_by_note.js <NUNOTA or NUMNOTA>
 * Example: node test_order_by_note.js 23534
 */
async function testOrderInfo() {
    const noteId = process.argv[2];

    if (!noteId) {
        console.log('❌ Por favor, forneça um número de nota (NUNOTA ou NUMNOTA).');
        console.log('Exemplo: node test_order_by_note.js 23534');
        process.exit(1);
    }

    console.log(`\n🔍 Buscando informações da nota: "${noteId}"...\n`);

    try {
        await sankhyaService.login();

        // 1. Get Header Info
        console.log('--- CABEÇALHO ---');
        const headerInfo = await sankhyaService.getOrderFiscalInfo(noteId);

        if (!headerInfo.success) {
            console.log(headerInfo.message);
            return;
        }

        console.log(headerInfo.message);
        console.log('Dados brutos:', JSON.stringify(headerInfo.data, null, 2));

        // 2. Get Items
        const nunota = headerInfo.data.nunota;
        console.log(`\n--- ITENS (NUNOTA: ${nunota}) ---`);

        const itemsInfo = await sankhyaService.getOrderItems(nunota);

        if (!itemsInfo.success) {
            console.log(itemsInfo.message);
        } else {
            console.log(itemsInfo.message);
        }

    } catch (error) {
        console.error('\n❌ Erro ao buscar nota:', error.message);
    }
}

testOrderInfo();
