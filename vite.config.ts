import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import crypto from 'crypto'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'shopee-api-middleware',
        configureServer(server) {
          server.middlewares.use('/api/generate-link', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method Not Allowed' }))
              return
            }

            // Parse request body
            let body = ''
            for await (const chunk of req) {
              body += chunk
            }

            let parsed
            try {
              parsed = JSON.parse(body)
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid JSON body' }))
              return
            }

            const { originUrl, subIds, shopeeAppId, shopeeSecret } = parsed

            if (!originUrl) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'originUrl is required' }))
              return
            }

            // Credentials from request body (per-user, decrypted from DB)
            const appId = shopeeAppId || env.SHOPEE_APP_ID || env.VITE_SHOPEE_APP_ID
            const secret = shopeeSecret || env.SHOPEE_SECRET || env.VITE_SHOPEE_SECRET

            if (!appId || !secret) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Credenciais da Shopee não fornecidas. Configure em Configurações → Shopee API.' }))
              return
            }

            try {
              const timestamp = Math.floor(Date.now() / 1000)

              const cleanSubIds = (subIds || [])
                .filter((id: string) => typeof id === 'string' && id.trim() !== '')
                .slice(0, 5)
                .map((id: string) => id.trim())

              const subIdsStr = JSON.stringify(cleanSubIds)
              const query = `mutation { generateShortLink(input: { originUrl: "${originUrl.replace(/"/g, '\\"')}", subIds: ${subIdsStr} }) { shortLink } }`

              const payload = JSON.stringify({ query })

              const stringToSign = appId + timestamp + payload + secret
              const signature = crypto.createHash('sha256').update(stringToSign).digest('hex')

              const shopeeResponse = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
                },
                body: payload
              })

              const data = await shopeeResponse.json()

              if (data.errors && data.errors.length > 0) {
                console.error('Shopee GraphQL Error:', data.errors)
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: data.errors[0].message || 'Erro na API da Shopee' }))
                return
              }

              const shortLink = data?.data?.generateShortLink?.shortLink

              if (!shortLink) {
                console.error('Empty shortLink. Response:', JSON.stringify(data))
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'A Shopee retornou resposta vazia. Tente novamente.' }))
                return
              }

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ shortLink }))

            } catch (error) {
              console.error('Link generation failed:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Erro interno ao gerar link.' }))
            }
          })

          // Fetch product data middleware (dev only)
          server.middlewares.use('/api/fetch-product', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method Not Allowed' }))
              return
            }

            let body = ''
            for await (const chunk of req) {
              body += chunk
            }

            let parsed
            try {
              parsed = JSON.parse(body)
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid JSON body' }))
              return
            }

            const { shopId, itemId, shopeeAppId, shopeeSecret } = parsed

            if (!shopId || !itemId) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'shopId and itemId are required' }))
              return
            }

            const appId = shopeeAppId || env.SHOPEE_APP_ID || env.VITE_SHOPEE_APP_ID
            const secret = shopeeSecret || env.SHOPEE_SECRET || env.VITE_SHOPEE_SECRET

            if (!appId || !secret) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Credenciais da Shopee não fornecidas.' }))
              return
            }

            async function shopeeQuery(queryString: string) {
              const timestamp = Math.floor(Date.now() / 1000)
              const payload = JSON.stringify({ query: queryString })
              const stringToSign = appId + timestamp + payload + secret
              const signature = crypto.createHash('sha256').update(stringToSign).digest('hex')

              const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
                },
                body: payload
              })
              return response.json()
            }

            try {
              // Fetch product data
              const productQuery = `{ productOfferV2(listType: 0, limit: 1, itemId: ${itemId}) { nodes { itemId productName price priceMin priceMax priceDiscountRate imageUrl ratingStar sales commission commissionRate sellerCommissionRate shopeeCommissionRate appExistRate appNewRate webExistRate webNewRate shopId shopName shopType productCatIds productLink offerLink periodStartTime periodEndTime } } }`

              const productResult = await shopeeQuery(productQuery)

              if (productResult.errors && productResult.errors.length > 0) {
                console.error('Shopee product query error:', productResult.errors)
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: productResult.errors[0].message || 'Erro ao buscar produto' }))
                return
              }

              const productNodes = productResult?.data?.productOfferV2?.nodes || []
              const product = productNodes.length > 0 ? productNodes[0] : null

              // Fetch shop data (non-fatal)
              let shop = null
              try {
                const shopQuery = `{ shopOfferV2(limit: 1, shopId: ${shopId}) { nodes { shopId shopName commissionRate ratingStar remainingBudget imageUrl shopType sellerCommCoveRatio } } }`
                const shopResult = await shopeeQuery(shopQuery)
                if (!shopResult.errors) {
                  const shopNodes = shopResult?.data?.shopOfferV2?.nodes || []
                  shop = shopNodes.length > 0 ? shopNodes[0] : null
                }
              } catch (shopErr) {
                console.error('Shop query error (non-fatal):', shopErr)
              }

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ product, shop }))

            } catch (error) {
              console.error('Product fetch failed:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Erro interno ao buscar dados do produto.' }))
            }
          })

          // Fetch Conversion Report middleware (dev only)
          server.middlewares.use('/api/fetch-conversions', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method Not Allowed' }))
              return
            }

            let body = ''
            for await (const chunk of req) {
              body += chunk
            }

            let parsed
            try {
              parsed = JSON.parse(body)
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid JSON body' }))
              return
            }

            const { shopeeAppId, shopeeSecret, purchaseTimeStart, purchaseTimeEnd, limit: queryLimit, scrollId } = parsed

            if (!purchaseTimeStart) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'purchaseTimeStart is required' }))
              return
            }

            const appId = shopeeAppId || env.SHOPEE_APP_ID || env.VITE_SHOPEE_APP_ID
            const secret = shopeeSecret || env.SHOPEE_SECRET || env.VITE_SHOPEE_SECRET

            if (!appId || !secret) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Credenciais da Shopee não fornecidas.' }))
              return
            }

            try {
              const timestamp = Math.floor(Date.now() / 1000)

              const args = [`purchaseTimeStart: ${purchaseTimeStart}`]
              if (purchaseTimeEnd) args.push(`purchaseTimeEnd: ${purchaseTimeEnd}`)
              args.push(`limit: ${queryLimit || 100}`)
              if (scrollId) args.push(`scrollId: "${scrollId}"`)

              const query = `{ conversionReport(${args.join(', ')}) { nodes { clickTime purchaseTime checkoutId conversionId conversionStatus grossCommission cappedCommission totalBrandCommission estimatedTotalCommission shopeeCommissionCapped sellerCommission totalCommission netCommission mcnManagementFeeRate mcnManagementFee buyerType utmContent device productType referrer orders { orderId shopType orderStatus items { shopId shopName completeTime promotionId modelId itemId itemName itemPrice displayItemStatus actualAmount refundAmount qty imageUrl itemTotalCommission itemSellerCommission itemSellerCommissionRate itemShopeeCommissionCapped itemShopeeCommissionRate itemNotes globalCategoryLv1Name globalCategoryLv2Name globalCategoryLv3Name fraudStatus fraudReason attributionType channelType campaignPartnerName campaignType } } } pageInfo { hasNextPage scrollId } } }`

              const payload = JSON.stringify({ query })
              const stringToSign = appId + timestamp + payload + secret
              const signature = crypto.createHash('sha256').update(stringToSign).digest('hex')

              const shopeeResponse = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
                },
                body: payload
              })

              const data = await shopeeResponse.json()

              if (data.errors && data.errors.length > 0) {
                console.error('Shopee conversionReport error:', data.errors)
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: data.errors[0].message || 'Erro na API da Shopee' }))
                return
              }

              const report = data?.data?.conversionReport || {}
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                nodes: report.nodes || [],
                pageInfo: report.pageInfo || { hasNextPage: false }
              }))
            } catch (error) {
              console.error('Conversion report fetch failed:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Erro interno ao buscar relatório de conversões.' }))
            }
          })

          // Fetch Validated Report middleware (dev only)
          server.middlewares.use('/api/fetch-validated', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method Not Allowed' }))
              return
            }

            let body = ''
            for await (const chunk of req) {
              body += chunk
            }

            let parsed
            try {
              parsed = JSON.parse(body)
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid JSON body' }))
              return
            }

            const { shopeeAppId, shopeeSecret, limit: queryLimit, scrollId } = parsed

            const appId = shopeeAppId || env.SHOPEE_APP_ID || env.VITE_SHOPEE_APP_ID
            const secret = shopeeSecret || env.SHOPEE_SECRET || env.VITE_SHOPEE_SECRET

            if (!appId || !secret) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Credenciais da Shopee não fornecidas.' }))
              return
            }

            try {
              const timestamp = Math.floor(Date.now() / 1000)

              const args = [`limit: ${queryLimit || 100}`]
              if (scrollId) args.push(`scrollId: "${scrollId}"`)

              const query = `{ validatedReport(${args.join(', ')}) { nodes { clickTime purchaseTime conversionId shopeeCommissionCapped sellerCommission totalCommission netCommission mcnManagementFeeRate mcnManagementFee buyerType utmContent device productType referrer orders { orderId shopType orderStatus items { shopId shopName completeTime promotionId modelId itemId itemName itemPrice displayItemStatus actualAmount refundAmount qty imageUrl itemTotalCommission itemSellerCommission itemSellerCommissionRate itemShopeeCommissionCapped itemShopeeCommissionRate itemNotes globalCategoryLv1Name globalCategoryLv2Name globalCategoryLv3Name fraudStatus fraudReason attributionType channelType campaignPartnerName campaignType } } } pageInfo { hasNextPage scrollId } } }`

              const payload = JSON.stringify({ query })
              const stringToSign = appId + timestamp + payload + secret
              const signature = crypto.createHash('sha256').update(stringToSign).digest('hex')

              const shopeeResponse = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
                },
                body: payload
              })

              const data = await shopeeResponse.json()

              if (data.errors && data.errors.length > 0) {
                console.error('Shopee validatedReport error:', data.errors)
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: data.errors[0].message || 'Erro na API da Shopee' }))
                return
              }

              const report = data?.data?.validatedReport || {}
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                nodes: report.nodes || [],
                pageInfo: report.pageInfo || { hasNextPage: false }
              }))
            } catch (error) {
              console.error('Validated report fetch failed:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Erro interno ao buscar relatório validado.' }))
            }
          })

          // Resolve shortened Shopee URL middleware (dev only)
          server.middlewares.use('/api/resolve-shopee-url', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method Not Allowed' }))
              return
            }

            let body = ''
            for await (const chunk of req) {
              body += chunk
            }

            let parsed
            try {
              parsed = JSON.parse(body)
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid JSON body' }))
              return
            }

            const { shortUrl } = parsed

            if (!shortUrl) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'shortUrl is required' }))
              return
            }

            try {
              const response = await fetch(shortUrl, { redirect: 'manual' })
              const location = response.headers.get('location')

              if (!location) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Não foi possível resolver o link. Nenhum redirect encontrado.' }))
                return
              }

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ resolvedUrl: location }))
            } catch (error) {
              console.error('URL resolve failed:', error)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Erro ao resolver URL encurtada.' }))
            }
          })
        }
      }
    ],
  }
})
