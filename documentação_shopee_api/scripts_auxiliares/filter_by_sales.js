const crypto = require('crypto');

const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function fetchPage(page) {
    const timestamp = Math.floor(Date.now() / 1000);

    // ESTRATÉGIA:
    // 1. Não existe parâmetro "minSales" na API.
    // 2. Usamos sortType: 4 (se for vendas?? Vencendo a confusão de docs: 
    //    Na minha doc atualizada, sortType 4 é Preço (Low to High), 2 é Mais Vendidos. 
    //    Vou checar a doc. Docs diz: `sortType: 2` = Item Sold Desc (Mais Vendidos).
    //    Então usamos sortType: 2.

    const query = `
    query {
      productOfferV2(
        keyword: "fone", 
        limit: 50, 
        page: ${page},
        sortType: 2 
      ) {
        nodes {
          productName
          price
          sales      # Campo descoberto (number)
          ratingStar # Campo descoberto
          offerLink
        }
        pageInfo {
          hasNextPage
        }
      }
    }
    `;

    const payload = JSON.stringify({ query });
    const stringToSign = APP_ID + timestamp + payload + SECRET;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
            },
            body: payload
        });
        return await response.json();
    } catch (e) {
        return { errors: [e] };
    }
}

async function searchHighSalesProducts() {
    console.log("Iniciando busca de produtos com MAIS DE 10.000 VENDAS...");

    let highSalesItems = [];
    let page = 1;

    // Vamos buscar até 3 páginas (150 itens) para filtrar
    while (page <= 3) {
        const data = await fetchPage(page);

        if (data.errors) {
            console.error("Erro:", data.errors);
            break;
        }

        const nodes = data.data.productOfferV2.nodes || [];
        if (nodes.length === 0) break;

        // FILTRAGEM (Lógica de Negócio):
        // Aqui filtramos o que a API não filtrou
        const minSalesTarget = 10000;

        const goodItems = nodes.filter(item => {
            // Nota: sales vem como int? Vamos garantir
            return item.sales >= minSalesTarget;
        });

        console.log(`Página ${page}: ${nodes.length} itens. Passaram no filtro: ${goodItems.length}`);

        highSalesItems.push(...goodItems);

        if (!data.data.productOfferV2.pageInfo.hasNextPage) break;
        page++;
        await new Promise(r => setTimeout(r, 500)); // Delayzinho leve
    }

    console.log(`\n\n=== RESULTADO FINAL ===`);
    console.log(`Encontrados ${highSalesItems.length} produtos com > 10k vendas.`);

    highSalesItems.slice(0, 5).forEach(item => {
        console.log(`\n[${item.sales} Vendas] ${item.productName}`);
        console.log(`Link: ${item.offerLink}`);
    });
}

searchHighSalesProducts();
