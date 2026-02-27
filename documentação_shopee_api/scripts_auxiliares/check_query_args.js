const crypto = require('crypto');

const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function executeQuery(label, queryVal) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query: queryVal });
    const stringToSign = APP_ID + timestamp + payload + SECRET;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    console.log(`\n=== DEEP INSPECTION: ${label} ===`);
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

        // Navegar até os argumentos do field productOfferV2 na Query root
        const fields = data.data.__type.fields;
        const targetField = fields.find(f => f.name === 'productOfferV2');

        if (targetField && targetField.args) {
            console.log("Argumentos aceitos por productOfferV2:");
            targetField.args.forEach(arg => {
                console.log(`- ${arg.name} (${arg.type.kind} ${arg.type.name || arg.type.ofType?.name})`);
            });
        } else {
            console.log("Campo não encontrado ou sem argumentos.");
        }

    } catch (e) {
        console.error("Falha:", e);
    }
}

async function inspectArguments() {
    // Introspection na Root Query para ver os argumentos de productOfferV2
    const query = `
    query {
      __type(name: "Query") {
        fields {
          name
          args {
            name
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    }
    `;
    await executeQuery("Argumentos de productOfferV2", query);
}

inspectArguments();
