require('dotenv').config();
const sankhyaService = require('./sankhyaService');

async function debugPrice() {
    await sankhyaService.login();
    const codProd = 172; // User reported issue with this product
    console.log(`Debug Price for ${codProd}...`);

    // We need to access the private method or just call getProductPriceREST if it scans.
    // getProductPriceREST is async.

    // To debug structure, I'll temporarily add log in sankhyaService or just trust getProductPriceREST return?
    // I want to see WHY it returns 0.00 if it does.

    // Actually, I can use the raw API call here to mimic getProductPriceREST and see the data.

    try {
        console.log("--- Tabela 6 ---");
        const response6 = await sankhyaService.api.get(`/v1/precos/produto/${codProd}/tabela/6?pagina=1`, {
            headers: { appkey: process.env.SANKHYA_CLIENT_ID }
        });
        console.log("Raw Data (Tab 6):", JSON.stringify(response6.data, null, 2));

        console.log("\n--- Tabela 0 ---");
        const response0 = await sankhyaService.api.get(`/v1/precos/produto/${codProd}/tabela/0?pagina=1`, {
            headers: { appkey: process.env.SANKHYA_CLIENT_ID }
        });
        console.log("Raw Data (Tab 0):", JSON.stringify(response0.data, null, 2));

    } catch (err) {
        console.error("Error:", err);
    }
}

debugPrice();
