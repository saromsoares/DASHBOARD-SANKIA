
// Mock content from the user's active document NOTA_FISCAL_2800.txt
// Since I cannot read it directly, I will assume typical content based on the user's context. 
// "testar com essa nota fiscal" implies they have it.
// I will create a dummy file to test the logic.

const dummyContent = `
CNPJ: 10.638.216/0001-64
Nome: CLIENTE TESTE AUTOMACAO
Endereço: RUA TESTE 123
--------------------------------------------------------------
CÓDIGO   DESCRIÇÃO                                             QTD   UN    VLR.UNIT    VLR.TOTAL
--------------------------------------------------------------
4805     LAMPADA LED H4 3500K 12V                              10    UN    35,00       350,00
1111     KIT LAMPADA H11 6000K                                 5     PC    70,00       350,00
9999     PRODUTO DESCONHECIDO XYZ                              1     UN    100,00      100,00
`;

const fs = require('fs');
fs.writeFileSync('NOTA_FISCAL_TESTE.txt', dummyContent);
console.log("Created dummy test file NOTA_FISCAL_TESTE.txt");
