const crypto = require('crypto');

// --- CONFIGURAÇÃO ---
const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function buscarProdutos(termo) {
    const query = `
    query {
      productOfferV2(keyword: "${termo}", limit: 5, sortType: 2) {
        nodes {
          productName
          priceMin
          sellerCommissionRate
          offerLink
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
    console.log(`\nResultados para: ${termo}`);
    console.table(result.data.productOfferV2.nodes);
}

// Execução do exemplo
buscarProdutos("iphone");
