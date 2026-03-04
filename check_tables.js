require('dotenv').config();
const sankhyaService = require('./sankhyaService');

async function checkTables() {
    await sankhyaService.login();
    console.log("Prod | Tab | Price");
    console.log("-----|-----|------");

    console.log("Prod | Tab 5 | Tab 6");
    console.log("-----|-------|------");

    const products = [172, 397, 347];
    for (const cod of products) {
        const p5 = await getPrice(sankhyaService, cod, 5);
        const p6 = await getPrice(sankhyaService, cod, 6);
        console.log(`${cod} | ${p5} | ${p6}`);
    }
}

async function getPrice(service, cod, tab) {
    try {
        const res = await service.api.get(`/v1/precos/produto/${cod}/tabela/${tab}?pagina=1`, {
            headers: { appkey: process.env.SANKHYA_CLIENT_ID }
        });
        const data = res.data;
        let price = 0;
        if (data.produtos && data.produtos.length > 0) price = data.produtos[0].valor;
        else if (data.precos && data.precos.length > 0) price = data.precos[0].valor;
        else if (data.result && data.result.length > 0) price = data.result[0].valor;

        return price;
    } catch (e) {
        return "ERR";
    }
}

checkTables();
