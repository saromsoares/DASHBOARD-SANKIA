const axios = require('axios');

async function testApi() {
    try {
        console.log('📡 Testando endpoint /api/fiscal...');

        // NUNOTA 23534 (or NUMNOTA)
        const payload = { numero_nota: "23534" };

        const res = await axios.post('http://localhost:3000/api/fiscal', payload);

        console.log('\n✅ Resposta do Servidor:');
        console.log('--------------------------------------------------');
        console.log(res.data.texto_resposta);
        console.log('--------------------------------------------------');

    } catch (err) {
        console.error('❌ Erro:', err.message);
        if (err.response) {
            console.error('Dados:', err.response.data);
        }
    }
}

testApi();
