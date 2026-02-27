const crypto = require('crypto');

// Credentials
const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

function calculateSignature(payload, timestamp) {
    const stringToSign = APP_ID + timestamp + payload + SECRET;
    return crypto.createHash('sha256').update(stringToSign).digest('hex');
}

async function callApi(name, query) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query });
    const signature = calculateSignature(payload, timestamp);

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
        console.log(`\n--- Result for ${name} ---`);
        if (data.errors) {
            console.error(`Status: FAILED`);
            console.error(JSON.stringify(data.errors, null, 2));
        } else {
            console.log(`Status: SUCCESS`);
            // Show first node if available
            const rootKey = Object.keys(data.data)[0];
            if (data.data[rootKey] && data.data[rootKey].nodes && data.data[rootKey].nodes.length > 0) {
                console.log('Sample data found:', JSON.stringify(data.data[rootKey].nodes[0], null, 2));
            } else {
                console.log('Response content:', JSON.stringify(data.data, null, 2));
            }
        }
    } catch (error) {
        console.error(`Request Failed for ${name}:`, error.message);
    }
}

async function validateAll() {
    // 1. Shopee Offer
    await callApi('shopeeOfferV2', `
    query {
      shopeeOfferV2(limit: 1) {
        nodes {
          offerName
          offerLink
        }
      }
    }`);

    // 2. Shop Offer (Brand)
    await callApi('shopOfferV2', `
    query {
      shopOfferV2(limit: 1) {
        nodes {
          shopName
          commissionRate
          ratingStar
        }
      }
    }`);

    // 3. Product Offer
    await callApi('productOfferV2', `
    query {
      productOfferV2(keyword: "iphone", limit: 1) {
        nodes {
          productName
          priceMin
          sellerCommissionRate
        }
      }
    }`);

    // 4. Conversion Report (Last 3 days)
    const threeDaysAgo = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60);
    await callApi('conversionReport', `
    query {
      conversionReport(purchaseTimeStart: ${threeDaysAgo}, limit: 1) {
        nodes {
          conversionId
          netCommission
          purchaseTime
        }
      }
    }`);

    // 5. Short Link
    await callApi('generateShortLink', `
    mutation {
      generateShortLink(input: {
        originUrl: "https://shopee.com.br/product/123/456",
        subIds: ["test"]
      }) {
        shortLink
      }
    }`);
}

validateAll();
