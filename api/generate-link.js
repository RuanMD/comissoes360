import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { originUrl, subIds, shopeeAppId, shopeeSecret } = req.body;

    if (!originUrl) {
        return res.status(400).json({ error: 'originUrl is required' });
    }

    // Credentials from request body (per-user, decrypted from DB on client side)
    // Fallback to env vars during migration period
    const appId = shopeeAppId || process.env.SHOPEE_APP_ID || process.env.VITE_SHOPEE_APP_ID;
    const secret = shopeeSecret || process.env.SHOPEE_SECRET || process.env.VITE_SHOPEE_SECRET;

    if (!appId || !secret) {
        return res.status(400).json({ error: 'Credenciais da Shopee não fornecidas. Configure em Configurações → Shopee API.' });
    }

    try {
        const timestamp = Math.floor(Date.now() / 1000);

        // Sanitize subIds - only strings, max 5
        const cleanSubIds = (subIds || [])
            .filter(id => typeof id === 'string' && id.trim() !== '')
            .slice(0, 5)
            .map(id => id.trim());

        // Build the GraphQL mutation payload
        const subIdsStr = JSON.stringify(cleanSubIds);
        const query = `mutation { generateShortLink(input: { originUrl: "${originUrl.replace(/"/g, '\\"')}", subIds: ${subIdsStr} }) { shortLink } }`;

        const payload = JSON.stringify({ query });

        // Generate Signature: SHA256(AppId + Timestamp + Payload + Secret)
        const stringToSign = appId + timestamp + payload + secret;
        const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

        // Make Request to Shopee Affiliate API
        const shopeeResponse = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
            },
            body: payload
        });

        const data = await shopeeResponse.json();

        // Check for GraphQL errors
        if (data.errors && data.errors.length > 0) {
            console.error("Shopee GraphQL Error:", data.errors);
            return res.status(400).json({ error: data.errors[0].message || 'Erro na API da Shopee ao gerar link' });
        }

        // Return the successfully generated link
        const shortLink = data?.data?.generateShortLink?.shortLink;

        if (!shortLink) {
            console.error("Empty shortLink from Shopee. Full response:", JSON.stringify(data));
            return res.status(500).json({ error: 'A Shopee retornou uma resposta vazia. Tente novamente.' });
        }

        return res.status(200).json({ shortLink });

    } catch (error) {
        console.error("Link generation failed:", error);
        return res.status(500).json({ error: 'Erro interno ao gerar link. Verifique os logs do servidor.' });
    }
}
