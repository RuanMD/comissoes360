const crypto = require('crypto');

const APP_ID = '18364470827';
const SECRET = 'DHF6Z324UXMHPJRA6JYNMFEZ22ILJOZG';
const URL = 'https://open-api.affiliate.shopee.com.br/graphql';

async function executeQuery(label, queryVal) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ query: queryVal });
  const stringToSign = APP_ID + timestamp + payload + SECRET;
  const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

  console.log(`\n=== TENTATIVA: ${label} ===`);

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
      console.log("❌ Retorno de Erro (Isso é bom, lemos a msg de erro):");
      // Limita msg de erro pra nao poluir
      console.log(JSON.stringify(data.errors[0].message, null, 2));
      return;
    }

    console.log("✅ SUCESSO! A query funcionou.");
    if (label.includes("Schema")) {
      const typeName = data.data.__type.name;
      console.log(`\nCampos em ${typeName}:`);
      data.data.__type.fields.forEach(f => {
        let typeStr = f.type.name;
        if (!typeStr && f.type.kind === 'NON_NULL') {
          typeStr = `${f.type.ofType.name}!`;
        } else if (!typeStr && f.type.kind === 'LIST') {
          typeStr = `[${f.type.ofType.name}]`;
        }
        console.log(`- ${f.name} (${typeStr || f.type.kind})`);
      });
    } else if (label.includes("Introspection")) {
      console.log("Tipos encontrados:", data.data.__schema.types.length);
    } else {
      console.log("Dados:", JSON.stringify(data.data, null, 2).substring(0, 300) + "...");
    }

  } catch (e) {
    console.error("Falha na requisição:", e.message);
  }
}

async function runDiscovery() {
  // 1. TENTATIVA DE INTROSPECTION (O "Mapa do Tesouro")
  // Se isso funcionar, descobrimos TODOS os campos da API.
  const introspectionQuery = `
    query {
      __schema {
        types {
          name
          fields {
            name
            type {
              name
            }
          }
        }
      }
    }
    `;
  await executeQuery("1. GraphQL Introspection", introspectionQuery);

  // 2. TENTATIVA DE "ADIVINHAÇÃO" (Field Guessing)
  // Vamos pedir campos comuns que não estão na doc, mas existem em outros lugares.
  // O erro da API costuma dizer: "Cannot query field 'x'. Did you mean 'y'?"

  const guessedFieldsQuery = `
    query {
      productOfferV2(keyword: "iphone", limit: 1) {
        nodes {
          productName
          price
          
          # --- CAMPOS CHUTADOS ---
          ratingStar      # Comum em APIs Shopee
          soldCount       # Comum
          stock           # Comum
          discount        # Comum
          originalPrice   # Comum
          voucherStatus   # Para cupons
          shopLocation    # Localização
          brandName       # Marca
          catId           # Categoria
          
          # sales (Vendas - as vezes chama historical_sold)
          sales
          historical_sold
        }
      }
    }
    `;
  await executeQuery("2. Adivinhação de Campos (Guessing)", guessedFieldsQuery);
}

async function exploreSchema() {
  console.log("\n=== 3. EXPLORANDO SCHEMA (Deep Dive) ===");

  // Lista de tipos para investigar
  const typesToInspect = ["BannerInfo"];

  for (const typeName of typesToInspect) {
    console.log(`\nAnalyzing ${typeName}...`);
    const schemaQuery = `
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
                }
              }
            }
          }
        }
        `;
    await executeQuery(`Schema ${typeName}`, schemaQuery);
  }
}

exploreSchema();
