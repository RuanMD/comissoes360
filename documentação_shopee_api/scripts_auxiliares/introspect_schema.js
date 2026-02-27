const crypto = require('crypto');

const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function introspect(typeName) {
    const query = `
    query {
      __type(name: "${typeName}") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
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
    }`;

    const timestamp = Math.floor(Date.now() / 1000);
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

    const data = await response.json();
    console.log(`\n=== Type: ${typeName} ===`);
    if (data.data && data.data.__type) {
        data.data.__type.fields.forEach(f => {
            console.log(`- ${f.name}`);
        });
    } else {
        console.log("Not found or error:", JSON.stringify(data, null, 2));
    }
}

async function run() {
    // Try to find the root Query field for validatedReport to see its return type
    const queryRoot = `
    query {
      __schema {
        queryType {
          fields {
            name
            type {
                name
                kind
            }
          }
        }
      }
    }`;

    // Actually, let's just guess common names and verify
    await introspect("ValidatedReport");
    await introspect("ValidatedReportNode");
    await introspect("ConversionReport");
    await introspect("ConversionItem");
}

run();
