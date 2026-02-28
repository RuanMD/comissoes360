import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { shopId, itemId, shopeeAppId, shopeeSecret } = req.body;

    if (!shopId || !itemId) {
        return res.status(400).json({ error: 'shopId and itemId are required' });
    }

    const appId = shopeeAppId || process.env.SHOPEE_APP_ID || process.env.VITE_SHOPEE_APP_ID;
    const secret = shopeeSecret || process.env.SHOPEE_SECRET || process.env.VITE_SHOPEE_SECRET;

    if (!appId || !secret) {
        return res.status(400).json({ error: 'Credenciais da Shopee não fornecidas. Configure em Configurações → Shopee API.' });
    }

    async function shopeeQuery(queryString) {
        const timestamp = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ query: queryString });
        const stringToSign = appId + timestamp + payload + secret;
        const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

        const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
            },
            body: payload
        });
        return response.json();
    }

    try {
        // 1. Fetch product data
        const productQuery = `{ productOfferV2(listType: 0, limit: 1, itemId: ${itemId}) { nodes { itemId productName price priceMin priceMax priceDiscountRate imageUrl ratingStar sales commission commissionRate sellerCommissionRate shopeeCommissionRate appExistRate appNewRate webExistRate webNewRate shopId shopName shopType productCatIds productLink offerLink periodStartTime periodEndTime } } }`;

        const productResult = await shopeeQuery(productQuery);

        if (productResult.errors && productResult.errors.length > 0) {
            console.error('Shopee product query error:', productResult.errors);
            return res.status(400).json({
                error: productResult.errors[0].message || 'Erro ao buscar produto na Shopee'
            });
        }

        const productNodes = productResult?.data?.productOfferV2?.nodes || [];
        const product = productNodes.length > 0 ? productNodes[0] : null;

        // 2. Fetch shop data (non-fatal)
        let shop = null;
        try {
            const shopQuery = `{ shopOfferV2(limit: 1, shopId: ${shopId}) { nodes { shopId shopName commissionRate ratingStar remainingBudget imageUrl shopType sellerCommCoveRatio } } }`;

            const shopResult = await shopeeQuery(shopQuery);
            if (!shopResult.errors) {
                const shopNodes = shopResult?.data?.shopOfferV2?.nodes || [];
                shop = shopNodes.length > 0 ? shopNodes[0] : null;
            }
        } catch (shopErr) {
            console.error('Shop query error (non-fatal):', shopErr);
        }

        return res.status(200).json({ product, shop });

    } catch (error) {
        console.error('Product fetch failed:', error);
        return res.status(500).json({ error: 'Erro interno ao buscar dados do produto.' });
    }
}
