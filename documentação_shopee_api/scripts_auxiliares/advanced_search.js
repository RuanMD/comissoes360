const crypto = require('crypto');

const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function fetchPage(pageNumber = 1) {
    const timestamp = Math.floor(Date.now() / 1000);

    // FILTROS APLICADOS:
    // limit: 50 (Máximo permitido por página)
    // sortType: 4 (Ordenado por Vendas/Top Performing)
    // page: Número da página para paginação

    const query = `
    query {
      productOfferV2(
        keyword: "iphone", 
        limit: 50, 
        page: ${pageNumber},
        sortType: 4
      ) {
        nodes {
          productName
          price
          commissionRate
          offerLink
        }
        pageInfo {
          hasNextPage
          page
        }
      }
    }
    `;

    const payload = JSON.stringify({ query });
    const stringToSign = APP_ID + timestamp + payload + SECRET;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    const response = await fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
        },
        body: payload
    });

    return await response.json();
}

async function getAllItems() {
    let allNodes = [];
    let currentPage = 1;

    console.log("Iniciando busca (Meta: 100 itens)...");

    while (allNodes.length < 100) {
        console.log(`Buscando página ${currentPage}...`);
        const data = await fetchPage(currentPage);

        if (data.errors) {
            console.error(`Erro na Pág ${currentPage}:`, JSON.stringify(data.errors, null, 2));
            break;
        }

        const nodes = data.data.productOfferV2.nodes || [];
        allNodes.push(...nodes);
        console.log(`Página ${currentPage}: ${nodes.length} itens encontrados.`);

        if (!data.data.productOfferV2.pageInfo.hasNextPage || nodes.length === 0) {
            break;
        }

        currentPage++;
        if (allNodes.length < 100) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    console.log(`\nTotal Final: ${allNodes.length} itens coletados.`);

    if (allNodes.length > 0) {
        console.log("\n--- Exemplos (Início) ---");
        console.log(allNodes.slice(0, 3));
        console.log("\n--- Exemplos (Fim) ---");
        console.log(allNodes.slice(allNodes.length - 3));
    }
}

getAllItems();
