const fs = require('fs');
const sankhyaService = require('./sankhyaService');

async function getNext5OrdersDetails() {
    let logBuffer = '';
    const log = (msg) => {
        console.log(msg);
        logBuffer += msg + '\n';
    };

    try {
        const cnpj = '30409112000161';
        log(`🔐 Authenticating and fetching orders for CNPJ: ${cnpj}...`);

        // 1. Get Orders
        const ordersResult = await sankhyaService.getOrdersByCpfCnpj(cnpj);

        if (!ordersResult.success || !ordersResult.data || ordersResult.data.length === 0) {
            log('❌ No orders found or error fetching orders.');
            log(ordersResult.message);
            fs.writeFileSync('next_5_orders_log.txt', logBuffer, 'utf8');
            return;
        }

        // 2. Take next 5 (indices 5 to 10)
        const next5Orders = ordersResult.data.slice(5, 10);
        log(`✅ Found ${ordersResult.data.length} orders. Fetching details for the NEXT 5 (6-10)...`);

        // 3. Loop and get items
        for (const order of next5Orders) {
            log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            log(`📦 Pedido ${order.numnota} (NUNOTA: ${order.nunota})`);
            log(`   Data: ${order.data} | Valor: R$ ${order.valor} | Status: ${order.status}`);
            log(`   Fetching items...`);

            try {
                const itemsResult = await sankhyaService.getOrderItems(order.nunota);

                if (itemsResult.success && itemsResult.data && itemsResult.data.items) {
                    const items = itemsResult.data.items;

                    // Check for missing descriptions or where description matches NUNOTA (bug)
                    const codesToResolve = items
                        .filter(i => !i.descricao || i.descricao === 'Produto sem descrição' || String(i.descricao) === String(order.nunota))
                        .map(i => i.codprod);

                    let descriptionsMap = {};
                    if (codesToResolve.length > 0) {
                        try {
                            descriptionsMap = await sankhyaService.getProductDescriptions(codesToResolve);
                        } catch (e) {
                            log(`   ⚠️ Failed to resolve descriptions: ${e.message}`);
                        }
                    }

                    log(`   📋 Itens (${items.length}):`);
                    items.forEach((item, index) => {
                        let desc = item.descricao;
                        if (!desc || desc === 'Produto sem descrição' || String(desc) === String(order.nunota)) {
                            desc = descriptionsMap[item.codprod] || 'Descrição não disponível';
                        }

                        // Clean up description if it still looks like NUNOTA or just code
                        if (String(desc) === String(order.nunota)) desc = 'Descrição indisponível';

                        log(`     ${index + 1}. ${desc} (Cód: ${item.codprod})`);
                        log(`        Qtd: ${item.quantidade} | Unit: R$ ${item.valorUnitario} | Total: R$ ${item.valorTotal}`);
                    });
                } else {
                    log(`   ❌ Could not fetch items: ${itemsResult.message}`);
                }
            } catch (err) {
                log(`   ❌ Error processing order ${order.numnota}: ${err.message}`);
            }
        }

        log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        log('Done.');

    } catch (error) {
        log(`❌ Error: ${error.message}`);
    } finally {
        fs.writeFileSync('next_5_orders_log.txt', logBuffer, 'utf8');
    }
}

getNext5OrdersDetails();
