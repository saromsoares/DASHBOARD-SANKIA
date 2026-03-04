/**
 * Sankhya Connection Diagnostic Tool
 * 
 * Usage: node check_sankhya_connection.js
 * 
 * This script tests connectivity to the Sankhya API using credentials from .env.
 * It attempts authentication via Headers (standard) and checks for common errors.
 */

const sankhyaService = require('./sankhyaService');
require('dotenv').config();

async function testConnection() {
    console.log('\n🔍 DIAGNOSTIC: Testing Sankhya API Connection...');
    console.log('------------------------------------------------');

    const baseURL = process.env.SANKHYA_BASE_URL || 'https://api.sankhya.com.br';
    console.log(`📡 Base URL: ${baseURL}`);
    console.log(`🔑 Client ID: ${process.env.SANKHYA_CLIENT_ID?.substring(0, 8)}...`);
    console.log('------------------------------------------------');

    try {
        console.log('👉 Attempting Authentication...');
        await sankhyaService.login();
        console.log('\n✅ SUCCESS: Connection Established!');
        console.log('   The API is reachable and credentials are valid.');
        console.log(`   Bearer Token acquired: ${sankhyaService.bearerToken?.substring(0, 10)}...`);

    } catch (error) {
        // ... (Original Error Handling Skipped since we bypass login)
        console.log(error);
    }

    try {
        console.log('\n👉 Testing Data Access (Querying "Produto")...');
        // Simple query to get 1 product
        const body = {
            dataSet: {
                rootEntity: "Produto",
                includePresentationFields: "S",
                offsetPage: "0",
                criteria: {
                    expression: "1=1" // Get anything
                },
                entity: {
                    fieldset: {
                        list: "CODPROD,DESCRPROD"
                    }
                }
            }
        };

        // Note: Using 'mge' module by default
        const result = await sankhyaService.callService('CRUDServiceProvider.loadRecords', body, 'mge');

        const entities = result.responseBody?.entities?.entity;
        if (entities) {
            // Handle single object or array of objects
            const list = Array.isArray(entities) ? entities : [entities];

            console.log(`✅ SUCCESS: Data Retrieved! Found ${list.length} records in this page.`);

            // Show up to 5 items
            console.log('   Preview (First 5):');
            list.slice(0, 5).forEach((item, index) => {
                const cod = item.f0?.['$'] || item.CODPROD?.['$'] || item.CODPROD;
                const desc = item.f1?.['$'] || item.DESCRPROD?.['$'] || item.DESCRPROD;
                console.log(`   ${index + 1}. [${cod}] ${desc}`);
            });
        } else {
            console.log('⚠️  WARNING: Connected but no products found (or different structure).');
            console.log('   Response:', JSON.stringify(result.responseBody, null, 2));
        }

    } catch (err) {
        console.log('\n❌ FAILURE: Data Query Failed.');
        console.log(`   Error: ${err.message}`);
        if (err.response) {
            console.log(`   Status: ${err.response.status}`);
            console.log(`   Data: ${JSON.stringify(err.response.data)}`);
        }
    }

    console.log('------------------------------------------------\n');
}

testConnection();
