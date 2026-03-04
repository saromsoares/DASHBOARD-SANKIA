const XLSX = require('xlsx');
const sankhyaService = require('./sankhyaService');

/**
 * Script to update product references in Excel file.
 * Reads logic:
 * 1. Open 'DADOS PRODUTOS ASX.xlsx'
 * 2. Iterate rows (skipping header)
 * 3. Read Code from Column C (Index 2)
 * 4. Fetch Product Reference from Sankhya
 * 5. Write Reference to Column B (Index 1)
 * 6. Save as 'DADOS PRODUTOS ASX_UPDATED.xlsx'
 */

async function processFile() {
    try {
        console.log("📂 Lendo arquivo DADOS PRODUTOS ASX.xlsx ...");
        const workbook = XLSX.readFile('DADOS PRODUTOS ASX.xlsx');
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Get range
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        console.log(`📊 Total de linhas: ${range.e.r + 1}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        let updatedCount = 0;
        let notFoundCount = 0;
        let errorCount = 0;

        // Start from row 2 (index 1) to skip header
        const startRow = 1;

        for (let R = startRow; R <= range.e.r; ++R) {
            // Column C is index 2. Cell address: {c:2, r:R}
            const cellAddressC = { c: 2, r: R };
            const cellRefC = XLSX.utils.encode_cell(cellAddressC);
            const cellC = worksheet[cellRefC];

            if (!cellC || !cellC.v) continue; // Empty cell

            const code = String(cellC.v).trim();

            // Skip if it doesn't look like a code (optional check, but good for safety)
            if (code.length < 2) continue;

            process.stdout.write(`Processing Row ${R + 1}: ${code.padEnd(15)} `);

            try {
                // Use findProduct to get strict match structured data
                const product = await sankhyaService.findProduct(code);

                if (product && product.referencia) {
                    const ref = product.referencia;
                    process.stdout.write(`✅ Found: ${ref}\n`);

                    // Write to Column B (index 1)
                    const cellAddressB = { c: 1, r: R };
                    const cellRefB = XLSX.utils.encode_cell(cellAddressB);

                    // Creates cell if it doesn't exist
                    if (!worksheet[cellRefB]) worksheet[cellRefB] = { t: 's', v: '' };

                    worksheet[cellRefB].v = ref;
                    // Force string type just in case
                    worksheet[cellRefB].t = 's';

                    updatedCount++;
                } else {
                    process.stdout.write(`❌ Not found/No Ref\n`);
                    notFoundCount++;
                }
            } catch (err) {
                process.stdout.write(`⚠️ Error: ${err.message}\n`);
                errorCount++;
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log("💾 Salvando arquivo atualizado: DADOS PRODUTOS ASX_UPDATED.xlsx");
        XLSX.writeFile(workbook, 'DADOS PRODUTOS ASX_UPDATED.xlsx');

        console.log(`✨ Concluído!`);
        console.log(`   Atualizados: ${updatedCount}`);
        console.log(`   Não encontrados: ${notFoundCount}`);
        console.log(`   Erros: ${errorCount}`);

    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
    }
}

processFile();
