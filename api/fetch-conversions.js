import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { shopeeAppId, shopeeSecret, purchaseTimeStart, purchaseTimeEnd, limit, scrollId } = req.body;

    const appId = shopeeAppId || process.env.SHOPEE_APP_ID || process.env.VITE_SHOPEE_APP_ID;
    const secret = shopeeSecret || process.env.SHOPEE_SECRET || process.env.VITE_SHOPEE_SECRET;

    if (!appId || !secret) {
        return res.status(400).json({ error: 'Credenciais da Shopee não fornecidas.' });
    }

    try {
        const timestamp = Math.floor(Date.now() / 1000);

        const args = [];
        if (purchaseTimeStart) args.push(`purchaseTimeStart: ${purchaseTimeStart}`);
        if (purchaseTimeEnd) args.push(`purchaseTimeEnd: ${purchaseTimeEnd}`);
        args.push(`limit: ${limit || 999}`);
        args.push(`scrollId: "${scrollId || ''}"`);

        const query = `{
  conversionReport(${args.join(', ')}) {
    nodes {
      clickTime
      purchaseTime
      checkoutId
      conversionId
      conversionStatus

      grossCommission
      cappedCommission
      totalBrandCommission
      estimatedTotalCommission
      shopeeCommissionCapped
      sellerCommission
      totalCommission
      netCommission

      mcnManagementFeeRate
      mcnManagementFee
      mcnContractId
      linkedMcnName

      buyerType
      utmContent
      device
      productType
      referrer

      orders {
        orderId
        shopType
        orderStatus
        items {
          shopId
          shopName
          completeTime
          promotionId
          modelId
          itemId
          itemName
          itemPrice
          displayItemStatus
          actualAmount
          refundAmount
          qty
          imageUrl

          itemCommission
          grossBrandCommission
          itemTotalCommission
          itemSellerCommission
          itemSellerCommissionRate
          itemShopeeCommissionCapped
          itemShopeeCommissionRate
          itemNotes

          categoryLv1Name
          categoryLv2Name
          categoryLv3Name
          globalCategoryLv1Name
          globalCategoryLv2Name
          globalCategoryLv3Name

          fraudStatus
          fraudReason
          attributionType
          channelType
          campaignPartnerName
          campaignType
        }
      }
    }

    pageInfo {
      page
      limit
      hasNextPage
      scrollId
    }
  }
}`;

        const payload = JSON.stringify({ query });
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

        const data = await response.json();

        if (data.errors && data.errors.length > 0) {
            console.error('Shopee conversionReport error:', data.errors);
            return res.status(400).json({ error: data.errors[0].message || 'Erro na API da Shopee' });
        }

        const report = data?.data?.conversionReport || {};
        return res.status(200).json({
            nodes: report.nodes || [],
            pageInfo: report.pageInfo || { hasNextPage: false }
        });

    } catch (error) {
        console.error('Conversion report fetch failed:', error);
        return res.status(500).json({ error: 'Erro interno ao buscar relatório de conversões.' });
    }
}
