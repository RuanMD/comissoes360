const crypto = require('crypto');

const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function testFullQuery() {
    const timestamp = Math.floor(Date.now() / 1000);

    // Dados extraídos da URL do usuário:
    // URL: ...i.985552786.43570618254
    const shopId = 985552786;
    const keyword = "iPhone";

    // NOTA: Baseado em testes anteriores, alguns parâmetros solicitados (priceMin, priceMax, scrollId)
    // podem não ser argumentos válidos diretos da `productOfferV2` nesta versão da API.
    // Vou tentar incluí-los para teste, mas preparei o script para mostrar o erro se falhar.

    // Parametros solicitados:
    // keyword, sortType, page, limit, scrollId, priceMin, priceMax, shopId, productCatId

    // Correção: Removemos priceMin e priceMax que não são suportados como argumentos diretos.
    // productCatId parece ser aceito (ou pelo menos não deu erro ainda, vamos testar).
    // scrollId deve ser usado se houver paginação.

    // NOTA: Para filtrar por preço, você deve filtrar o resultado no seu código (Javascript/Python) 
    // após receber a resposta da API, pois a API productOfferV2 não aceita priceMin/priceMax como argumentos.

    const query = `
    query {
      productOfferV2(
        keyword: "${keyword}", 
        limit: 50, 
        page: 1,
        sortType: 1,
        shopId: ${shopId},
        productCatId: 100001
      ) {
        nodes {
          productName
          price
          shopName
          offerLink
        }
        pageInfo {
          page
          hasNextPage
          scrollId
        }
      }
    }
    `;

    // NOTA DE DESENVOLVIMENTO:
    // Se eu incluir parameters invalidos como 'priceMin' a API retorna erro 10010 (Unknown argument).
    // O usuário pediu TODOS. Vou colocar num comentário abaixo como seria a query "ideal" se a API aceitasse tudo,
    // mas executar a que FUNCIONA para ele ver o resultado do produto.

    /* 
    Query ideal solicitada (pode falhar na API real):
    productOfferV2(
        keyword: "${keyword}",
        limit: 50,
        page: 1,
        sortType: 1,
        shopId: ${shopId},
        priceMin: 100.0,
        priceMax: 10000.0,
        productCatId: 100001,
        scrollId: "xyz"
    )
    */

    const payload = JSON.stringify({ query });
    const stringToSign = APP_ID + timestamp + payload + SECRET;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    console.log("Executando query no Shop ID:", shopId);

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
        console.error("Erro na API:", JSON.stringify(data.errors, null, 2));
    } else {
        console.log("Sucesso! Produtos encontrados:");
        console.log(JSON.stringify(data.data.productOfferV2.nodes, null, 2));
    }
}

testFullQuery();
