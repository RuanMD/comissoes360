const crypto = require('crypto');

// Credentials provided by user
const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

// 1. Generate Timestamp
const timestamp = Math.floor(Date.now() / 1000);

// 2. Define Payload
const query = `
query {
  productOfferV2(keyword: "iphone", limit: 5) {
    nodes {
      productName
      price
      commissionRate
      offerLink
    }
  }
}
`;

const payload = JSON.stringify({ query });

// 3. Calculate Signature
// Signature = SHA256(AppId + Timestamp + Payload + Secret)
const stringToSign = APP_ID + timestamp + payload + SECRET;
const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

console.log('--- Authentication Details ---');
console.log('App ID:', APP_ID);
console.log('Timestamp:', timestamp);
console.log('Signature:', signature);
console.log('Payload:', payload);

// 4. Make Request
async function fetchProducts() {
    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
            },
            body: payload
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        console.log('\n--- API Response ---');
        if (data.errors) {
            console.error('API Errors:', JSON.stringify(data.errors, null, 2));
        } else {
            console.log(JSON.stringify(data.data, null, 2));
        }

    } catch (error) {
        console.error('Request Failed:', error);
    }
}

fetchProducts();
