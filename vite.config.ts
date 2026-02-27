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
        }
      }
    ],
  }
})
