const sankhyaService = require('./sankhyaService');

// This simulates the Agent calling the function
async function testAgentCall() {
    console.log('--- Simulando chamada do Agente ---\n');

    // First call: Authenticate
    await sankhyaService.login();

    // Second call: Ask for info
    const response = await sankhyaService.getProductInfo("LAMPADA LED");

    console.log('RESPOSTA DO AGENTE PARA O USUÁRIO:');
    console.log('-----------------------------------');
    console.log(response);
    console.log('-----------------------------------');
}

testAgentCall();
