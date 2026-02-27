const crypto = require('crypto');

const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function executeQuery(label, queryVal) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query: queryVal });
    const stringToSign = APP_ID + timestamp + payload + SECRET;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    console.log(`\n=== ESTRATÉGIA: ${label} ===`);

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

        let nodes = [];
        if (data.data.productOfferV2) nodes = data.data.productOfferV2.nodes || [];
        if (data.data.shopeeOfferV2) nodes = data.data.shopeeOfferV2.nodes || [];

        console.log(`Itens encontrados: ${nodes.length}`);

        if (nodes.length > 0) {
            // Exibir alguns detalhes relevantes
            console.log(nodes.slice(0, 3).map(item => ({
                name: item.productName || item.offerName,
                price: item.price,
                // Tenta exibir desconto se existir
                discount: item.priceDiscountRate ? `${item.priceDiscountRate}%` : 'N/A',
                link: item.offerLink
            })));
        }
    } catch (e) {
        console.error("Falha:", e);
    }
}

async function findPromotions() {
    // 1. "BARATINHOS": Ordenar por Preço Menor (Low to High)
    // sortType: 4
    // Ideal para grupos de "coisas por R$1,99"
    const cheapQuery = `
    query {
      productOfferV2(
        keyword: "fone", 
        limit: 5, 
        page: 1, 
        sortType: 4
      ) {
        nodes {
          productName
          price
          offerLink
          # Tentando buscar campos de desconto se existirem
          # priceDiscountRate 
        }
      }
    }
    `;
    // Nota: Vou comentar priceDiscountRate acima. Se quiser testar se existe, descomente.
    // O scrape inicial sugeriu que talvez não exista na V2 ou tenha outro nome.
    // Vamos testar a query básica primeiro.

    await executeQuery("1. Preços Baixos (SortType 4)", cheapQuery);

    // 2. CAMPANHAS SHOPEE: Ofertas Curadas pela Shopee
    // shopeeOfferV2
    // Geralmente retorna links de coleções de promoção (Black Friday, 12.12, etc)
    const campaignQuery = `
    query {
      shopeeOfferV2(
        limit: 5, 
        page: 1,
        sortType: 1
      ) {
        nodes {
          offerName
          offerLink
          offerType
        }
      }
    }
    `;
    await executeQuery("2. Campanhas Oficiais (ShopeeOffer)", campaignQuery);

    // 3. TENTATIVA DE DESCONTO: Vamos tentar pedir o campo 'priceDiscountRate'
    // Se falhar o script roda mas mostra erro. É bom para descobrir.
    const discountTestQuery = `
    query {
      productOfferV2(
        keyword: "iphone", 
        limit: 5,
        sortType: 2 # Mais vendidos
      ) {
        nodes {
          productName
          price
          # priceDiscountRate? Vamos testar se esse campo existe
        }
      }
    }
    `;
    // await executeQuery("3. Teste de Campo de Desconto", discountTestQuery);
}

findPromotions();
