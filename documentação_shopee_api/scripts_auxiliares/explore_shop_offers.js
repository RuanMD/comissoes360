const crypto = require('crypto');

const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function executeQuery(label, queryVal) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query: queryVal });
    const stringToSign = APP_ID + timestamp + payload + SECRET;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    console.log(`\n=== TESTE: ${label} ===`);
    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
            },
            body: payload
        });
        const data = await response.json();

        if (data.errors) {
            console.error("ERRO:", JSON.stringify(data.errors, null, 2));
            return;
        }

        const nodes = data.data.shopOfferV2.nodes || [];
        console.log(`Encontrados: ${nodes.length}`);
        if (nodes.length > 0) {
            // Mostra detalhes dos primeiros 2 resultados
            console.log(JSON.stringify(nodes.slice(0, 2), null, 2));
        }
    } catch (e) {
        console.error("Falha na execução:", e);
    }
}

async function runExploration() {
    // ESTRATÉGIA 1: Lojas Oficiais (Alta Confiança)
    // shopType: [1] (Official Shop)
    const officialShopsQuery = `
    query {
      shopOfferV2(
        page: 1, 
        limit: 5,
        shopType: [1]
      ) {
        nodes {
          shopName
          shopId
          commissionRate
          shopType
          offerLink
        }
      }
    }
    `;
    await executeQuery("1. Lojas Oficiais (Brands)", officialShopsQuery);

    // ESTRATÉGIA 2: Busca por Marca Específica (ex: Xiaomi)
    // Keyword: "Xiaomi"
    const brandSearchQuery = `
    query {
      shopOfferV2(
        page: 1, 
        limit: 5,
        keyword: "Xiaomi"
      ) {
        nodes {
          shopName
          commissionRate
          offerLink
        }
      }
    }
    `;
    await executeQuery("2. Busca por Marca 'Xiaomi'", brandSearchQuery);

    // ESTRATÉGIA 3: Ordenar por Maior Comissão
    // sortType: 2 (Highest Commission)
    const commissionQuery = `
    query {
      shopOfferV2(
        page: 1, 
        limit: 5,
        sortType: 2
      ) {
        nodes {
          shopName
          commissionRate
          offerLink
        }
      }
    }
    `;
    await executeQuery("3. Top Comissões", commissionQuery);
}

runExploration();
