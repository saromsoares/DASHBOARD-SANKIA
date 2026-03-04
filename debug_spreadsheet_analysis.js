const XLSX = require('xlsx');

async function analyzeResults() {
    console.log("📂 Analisando DADOS PRODUTOS ASX_UPDATED.xlsx ...");
    const workbook = XLSX.readFile('DADOS PRODUTOS ASX_UPDATED.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const range = XLSX.utils.decode_range(worksheet['!ref']);

    let notFound = [];
    let sameCode = [];

    for (let R = 1; R <= range.e.r; ++R) {
        // Col B (Index 1) = Reference (OUTPUT)
        // Col C (Index 2) = Code (INPUT)

        const cellRefC = XLSX.utils.encode_cell({ c: 2, r: R });
        const cellRefB = XLSX.utils.encode_cell({ c: 1, r: R });

        const codeCell = worksheet[cellRefC];
        const refCell = worksheet[cellRefB];

        if (!codeCell || !codeCell.v) continue;

        const code = String(codeCell.v).trim();
        const ref = refCell ? String(refCell.v).trim() : "";

        if (!ref) {
            notFound.push({ row: R + 1, code: code });
        } else if (ref === code) {
            sameCode.push({ row: R + 1, code: code, ref: ref });
        }
    }

    console.log(`\n❌ Total não encontrados: ${notFound.length}`);
    console.log("Exemplos (Primeiros 5):");
    notFound.slice(0, 5).forEach(i => console.log(`   Linha ${i.row}: ${i.code}`));

    console.log(`\n⚠️ Total com código igual a referência: ${sameCode.length}`);
    console.log("Exemplos (Primeiros 5):");
    sameCode.slice(0, 5).forEach(i => console.log(`   Linha ${i.row}: ${i.code} -> Ref: ${i.ref}`));
}

analyzeResults();
