const crypto = require('crypto');

// --- CONFIGURAÇÃO ---
const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function gerarLinkAfiliado(urlOriginal, tag) {
    const query = `
    mutation {
      generateShortLink(input: {
        originUrl: "${urlOriginal}",
        subIds: ["${tag}"]
      }) {
        shortLink
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
        console.error(`\nErro na API para [${tag}]:`, JSON.stringify(result.errors, null, 2));
        return;
    }
    console.log(`\nLink Gerado para [${tag}]:`, result.data.generateShortLink.shortLink);
}

// Execução do exemplo
gerarLinkAfiliado("https://shopee.com.br/product-i.123.456", "AdsFacebook");
