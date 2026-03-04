const sankhyaService = require('./sankhyaService');
const fs = require('fs');
const path = require('path');

async function generateInvoice(searchTerm) {
    try {
        if (!searchTerm) {
            console.log('Error: Please provide a Note Number (NUNOTA/NUMNOTA)');
            process.exit(1);
        }

        console.log('🔄 Buscando informações da nota...');

        // 1. Get Header Info
        const headerRes = await sankhyaService.getOrderFiscalInfo(searchTerm);
        if (!headerRes.success) {
            console.error('❌ ' + headerRes.message);
            process.exit(1);
        }
        const header = headerRes.data;

        // 2. Get Partner Name
        process.stdout.write('👤 Buscando cliente... ');
        const partnerName = await sankhyaService.getPartnerName(header.codparc);
        console.log('✅ ' + partnerName);

        // 3. Get Items
        process.stdout.write('📦 Buscando itens... ');
        const itemsRes = await sankhyaService.getOrderItems(header.nunota);
        if (!itemsRes.success) {
            console.error('\n❌ Erro ao buscar itens: ' + itemsRes.message);
            process.exit(1);
        }
        console.log(`✅ ${itemsRes.data.itemCount} itens encontrados.`);

        // 4. Get Product Descriptions
        process.stdout.write('🔍 Resolvendo nomes dos produtos... ');
        const codProds = itemsRes.data.items.map(i => i.codprod);
        const productMap = await sankhyaService.getProductDescriptions(codProds);
        console.log('✅');

        // 5. Assemble Data
        const itemsWithNames = itemsRes.data.items.map(item => ({
            ...item,
            descricao: productMap[item.codprod] || `Produto ${item.codprod}`
        }));

        // 6. Generate Output
        const invoiceOutput = generateInvoiceText(header, partnerName, itemsWithNames);

        // 7. Save to File
        const fileName = `NOTA_FISCAL_${header.numnota || header.nunota}.txt`;
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, invoiceOutput, 'utf8');

        console.log('\n📄 Nota Fiscal Gerada com Sucesso!');
        console.log(`📂 Arquivo salvo em: ${filePath}`);
        console.log('\n--- CONTEÚDO DA NOTA ---\n');
        console.log(invoiceOutput);

    } catch (error) {
        console.error('❌ Erro fatal:', error);
    }
}

function generateInvoiceText(header, partnerName, items) {
    const line = '─'.repeat(80);
    const doubleLine = '═'.repeat(80);
    const now = new Date().toLocaleString('pt-BR');

    let text = `${doubleLine}
              NOTA FISCAL - DOCUMENTO AUXILIAR
${doubleLine}

▶ DADOS DA NOTA
Número Nota....: ${header.numnota}
Nro Único......: ${header.nunota}
Série..........: 1
Data Emissão...: ${header.dtneg}
Status.........: ${header.statusText} (${header.status})
Chave NF-e.....: ${header.chavenfe}
Gerado em......: ${now}

${line}
▶ DESTINATÁRIO / CLIENTE
Nome/Razão.....: ${partnerName}
Cód. Parceiro..: ${header.codparc}

${doubleLine}

▶ ITENS DA NOTA
${line}
 #  | CÓDIGO | DESCRIÇÃO                                 | QTD  | UN.   |  TOTAL (R$)
${line}
`;

    items.forEach((item, idx) => {
        const idxStr = (idx + 1).toString().padStart(2, '0');
        const codStr = String(item.codprod).padEnd(6);
        // Truncate description to fit nicely
        let descStr = item.descricao.substring(0, 41).padEnd(41);
        const qtdStr = String(item.quantidade).padStart(4);
        const valTotalStr = item.valorTotal.padStart(10);

        text += ` ${idxStr} | ${codStr} | ${descStr} | ${qtdStr} | R$ ${valTotalStr}\n`;
    });

    text += `${line}
`;

    const totalItems = items.reduce((sum, i) => sum + parseFloat(i.valorTotal), 0);
    const valorNota = parseFloat(header.vlrnota);

    text += `TOTAL DOS ITENS................................................ R$ ${totalItems.toFixed(2).padStart(10)}
`;

    // If there's a difference (freight, IPI, etc), show it
    if (Math.abs(valorNota - totalItems) > 0.01) {
        const diff = valorNota - totalItems;
        text += `OUTRAS DESPESAS/IMPOSTOS....................................... R$ ${diff.toFixed(2).padStart(10)}\n`;
    }

    text += `TOTAL DA NOTA.................................................. R$ ${valorNota.toFixed(2).padStart(10)}
${doubleLine}
`;

    return text;
}

// Get arg
const arg = process.argv[2];
if (arg) {
    generateInvoice(arg);
} else {
    console.log('Uso: node generate_invoice.js [NUMERO_NOTA]');
}
