const crypto = require('crypto');

const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function executeQuery(queryName, queryStr) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query: queryStr });
    const stringToSign = APP_ID + timestamp + payload + SECRET;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    console.log(`\n--- Executando: ${queryName} ---`);
    console.log("Query enviada:", queryStr.replace(/\s+/g, ' ').trim().substring(0, 150) + "...");

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
        } else {
            const count = data.data.productOfferV2.nodes ? data.data.productOfferV2.nodes.length : 0;
            console.log(`SUCESSO! Itens retornados: ${count}`);
            if (count > 0) console.log("Exemplo:", data.data.productOfferV2.nodes[0].productName);
        }
    } catch (e) {
        console.error("Falha na requisição:", e);
    }
}

async function runDemos() {
    // CENÁRIO 1: Busca Completa (Search Mode)
    // Parâmetros usados: keyword, limit, page, sortType, shopId, productCatId, isAMSOffer, isKeySeller
    // priceMin/priceMax são inválidos e foram omitidos.
    const searchQuery = `
    query {
      productOfferV2(
        keyword: "iPhone",
        limit: 10,
        page: 1,
        sortType: 1,
        shopId: 985552786,
        productCatId: 100001,
        isAMSOffer: false,
        isKeySeller: false
      ) {
        nodes {
          productName
          price
          commissionRate
          shopName
        }
      }
    }
    `;
    await executeQuery("1. Busca com Filtros (Keyword, Shop, Cat, Booleans)", searchQuery);

    // CENÁRIO 2: List Mode (Mutuamente exclusivo com keyword)
    // Parâmetros usados: listType, matchId, limit, page
    // listType 3 = Landing Category
    // matchId 100001 = Mobile & Gadgets (exemplo)
    const listQuery = `
    query {
      productOfferV2(
        listType: 3,
        matchId: 100001,
        limit: 10,
        page: 1
      ) {
        nodes {
          productName
          price
        }
      }
    }
    `;
    await executeQuery("2. Modo Lista (listType + matchId)", listQuery);

    // CENÁRIO 3: Busca por Item ID Específico
    // Parâmetros: itemId
    const itemQuery = `
    query {
      productOfferV2(
        itemId: 23977551786
      ) {
        nodes {
          productName
          price
          offerLink
        }
      }
    }
    `;
    // Nota: Peguei um ID aleatório de exemplo ou teria que pegar um válido da busca anterior.
    // Se o ID não existir, retorna vazio, mas a query é válida.
    await executeQuery("3. Busca por Item ID", itemQuery);
}

runDemos();
