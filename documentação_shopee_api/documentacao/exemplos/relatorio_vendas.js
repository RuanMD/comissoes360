const crypto = require('crypto');

// --- CONFIGURAÇÃO ---
const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function verVendasRecentes() {
    // Pega vendas das últimas 24 horas
    const umDiaAtras = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

    const query = `
    query {
      conversionReport(purchaseTimeStart: ${umDiaAtras}, limit: 5) {
        nodes {
          conversionId
          purchaseTime
          netCommission
          conversionStatus
          orders {
            orderId
            items {
              itemName
              qty
            }
          }
        }
      }
    }`;

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query });
    const signature = crypto.createHash('sha256')
        .update(APP_ID + timestamp + payload + SECRET)
        .digest('hex');

    const response = await fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
        },
        body: payload
    });

    const result = await response.json();
    if (result.errors) {
        console.error(`\nErro na API:`, JSON.stringify(result.errors, null, 2));
        return;
    }
    console.log(`\nVendas Encontradas:`, result.data.conversionReport.nodes.length);
    if (result.data.conversionReport.nodes.length > 0) {
        console.log("Detalhe da primeira venda:", JSON.stringify(result.data.conversionReport.nodes[0], null, 2));
    }
}

// Execução do exemplo
verVendasRecentes();
