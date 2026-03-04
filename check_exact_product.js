const sankhyaService = require('./sankhyaService');

async function checkExactProduct() {
    const code = process.argv[2];
    if (!code) {
        console.log("Uso: node check_exact_product.js <CODPROD>");
        process.exit(1);
    }
    console.log(`🔎 Verifying existence of product with EXACT CODE: ${code}`);

    try {
        const body = {
            dataSet: {
                rootEntity: "Produto",
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: {
                    expression: { "$": `CODPROD = ${code}` }
                },
                entity: {
                    fieldset: {
                        list: "CODPROD,DESCRPROD,REFERENCIA,ATIVO"
                    }
                }
            }
        };

        const response = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');
        const entities = response.responseBody?.entities?.entity;

        if (!entities) {
            console.log(`❌ Produto com código ${code} NÃO encontrado.`);
        } else {
            const list = Array.isArray(entities) ? entities : [entities];
            const p = list[0];
            const cod = p.f0?.['$'] || p.CODPROD?.['$'] || p.CODPROD;
            const desc = p.f1?.['$'] || p.DESCRPROD?.['$'] || p.DESCRPROD;
            const ref = p.f2?.['$'] || p.REFERENCIA?.['$'] || p.REFERENCIA;
            const ativo = p.f3?.['$'] || p.ATIVO?.['$'] || p.ATIVO;

            // Fetch price/stock cleanly
            const stock = await sankhyaService.getProductStockREST(cod);
            const price = await sankhyaService.getProductPriceREST(cod, 6);

            console.log(`✅ Produto ENCONTRADO!`);
            console.log(`Código: ${cod}`);
            console.log(`Descrição: ${desc}`);
            console.log(`Referência: ${ref}`);
            console.log(`Ativo: ${ativo}`);
            console.log(`Estoque: ${stock}`);
            console.log(`Preço (Tab 6): R$ ${price}`);
        }

    } catch (error) {
        console.error("Erro ao verificar produto:", error);
    }
}

checkExactProduct();
