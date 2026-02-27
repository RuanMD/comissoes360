const crypto = require('crypto');

// --- CONFIGURAÇÃO ---
const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function buscarAltaComissao() {
    // Query focada em AMS (XTRA) com ordenação por maior taxa de comissão (sortType: 5)
    const query = `
    query {
      productOfferV2(isAMSOffer: true, limit: 10, sortType: 5) {
        nodes {
          productName
          price
          sellerCommissionRate
          shopeeCommissionRate
          commissionRate
          sales
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
        console.error("Erro na API:", JSON.stringify(result.errors, null, 2));
        return;
    }

    const produtos = result.data.productOfferV2.nodes.map(p => {
        const totalRate = parseFloat(p.sellerCommissionRate || 0) + parseFloat(p.shopeeCommissionRate || 0);
        return {
            "Produto": p.productName.substring(0, 40) + "...",
            "Preço": `R$ ${p.price}`,
            "Comissão Total": `${(totalRate * 100).toFixed(1)}%`,
            "Vendas": p.sales,
            "Link": p.offerLink
        };
    });

    console.log("\n🚀 PRODUTOS COM ALTA COMISSÃO ENCONTRADOS (XTRA/AMS):");
    console.table(produtos);
}

buscarAltaComissao();
