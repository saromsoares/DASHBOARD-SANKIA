const sankhyaService = require('./sankhyaService');

async function probeLinkedNoteSQL() {
    const nunota = 23534;
    console.log(`🕵️ Buscando NUNOTA de destino (Invoice) para origem ${nunota} via SQL...\n`);

    const body = {
        sql: `SELECT NUNOTA, NUMNOTA, STATUSNOTA, CHAVENFE FROM TGFCAB WHERE NUNOTAORIG = ${nunota}`
    };

    try {
        const response = await sankhyaService.callService('DbExplorerSP.executeQuery', body, 'mge');
        console.log('✅ Resposta SQL:', JSON.stringify(response.responseBody, null, 2));
    } catch (error) {
        console.log(`❌ Falha SQL: ${error.message}`);
    }
}

probeLinkedNoteSQL();
