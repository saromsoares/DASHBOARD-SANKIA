require('dotenv').config();
const sankhyaService = require('./sankhyaService');

async function runSimulation() {
    // sankhyaService is already an instance
    await sankhyaService.login();

    console.log("--- INÍCIO DA SIMULAÇÃO ---");
    console.log("👤 Cliente: Vocês tem lampada de led?");
    console.log("🤖 Bot: (Processando busca por 'lampada led'...)");

    const resposta = await sankhyaService.getProductInfo("lampada led");

    console.log("\n🤖 Bot Responde:");
    console.log(resposta);
    console.log("--- FIM DA SIMULAÇÃO ---");
}

runSimulation();
