const fs = require('fs');
// const pdf = require('pdf-parse'); // Disabled for now
const sankhyaService = require('./sankhyaService');

// --- Helper: Clean Text ---
function cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

// --- Step 1: Extract Info from TXT (Reliable Fallback) ---
async function extractInfoFromTXT(filePath) {
    try {
        const text = fs.readFileSync(filePath, 'utf-8');
        console.log("📄 Extracted Text Length:", text.length);

        // 1. Extract CNPJ (Client)
        // Look for typical patterns: "CNPJ: 12.345.678/0001-90" or just the number
        const cnpjMatch = text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
        const cnpj = cnpjMatch ? cnpjMatch[0].replace(/\D/g, '') : null;

        if (!cnpj) {
            console.error("❌ CNPJ not found in TXT.");
            return null;
        }

        console.log(`🏢 Found CNPJ: ${cnpj}`);

        // 2. Extract Items
        // Regex for the text file format (which is likely a structured dump)
        const lines = text.split('\n');
        const items = [];

        // Example content from previous conversations suggests a layout.
        // Let's look for lines that have a product code, description, quantity...
        // Common pattern in invoice txts: Code Desc Qty Unit Price Total

        // Trying a generic loose matcher:
        // [Number] [Text] [Number] [Unit] [Number]
        const itemRegex = /^(\d+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(UN|PC|CX|M|KG|RL|L)\s+/i;

        lines.forEach(line => {
            const clean = cleanText(line);
            const match = clean.match(itemRegex);

            // Filter out junk lines like "1 Note:..." or paginations
            if (match && match[2].length > 3 && !match[2].includes("Página")) {

                // Try to find price at the end of the line
                // The regex above captures up to Unit. The rest of line has price.
                const remaining = clean.substring(match[0].length);
                const priceMatch = remaining.match(/([\d.,]+)/); // First number after unit is usually Unit Price

                let price = 0;
                if (priceMatch) {
                    price = parseFloat(priceMatch[1].replace('.', '').replace(',', '.'));
                }

                items.push({
                    code: match[1],
                    description: match[2].trim(),
                    qty: parseFloat(match[3].replace(',', '.')),
                    unit: match[4],
                    price: price
                });
            }
        });

        console.log(`🛒 Found ${items.length} items in TXT.`);
        items.forEach(i => console.log(`   - ${i.code}: ${i.description} (${i.price})`));
        return { cnpj, items };

    } catch (e) {
        console.error("Error parsing TXT:", e);
        return null;
    }
}


// --- Step 2 & 3: History & Matching ---
async function matchProducts() {
    console.log("🚀 Starting History-Based Product Match...");

    // 1. Extract Data from TXT (Proxy for PDF)
    // Using the file the user actually has open and valid: NOTA_FISCAL_2800.txt
    const txtData = await extractInfoFromTXT('NOTA_FISCAL_REAL.txt');

    if (!txtData || !txtData.cnpj) {
        console.error("Failed to extract data from TXT.");
        return;
    }

    // 2. Fetch History (Candidate Pool)
    console.log(`\n📚 Fetching order history for CNPJ ${txtData.cnpj}...`);
    const history = await sankhyaService.getOrdersByCpfCnpj(txtData.cnpj);

    let candidatePool = [];

    if (!history.success || history.data.length === 0) {
        console.log("⚠️ No history found for this CNPJ.");
        // We could implement a fallback here (Simple Search)
    } else {
        console.log(`   Found ${history.data.length} recent orders.`);

        // Flatten all items from recent orders to build a "Known Products" list
        const processedCodes = new Set();
        const recentOrders = history.data.slice(0, 5); // Limit to last 5

        for (const order of recentOrders) {
            process.stdout.write(`   > Fetching items for Order #${order.numnota}... `);
            const itemsRes = await sankhyaService.getOrderItems(order.nunota);
            if (itemsRes.success) {
                console.log(`Found ${itemsRes.data.itemCount} items.`);
                if (itemsRes.data.items) {
                    for (const item of itemsRes.data.items) {
                        if (!processedCodes.has(item.codprod)) {
                            try {
                                // Fetch Description explicitly
                                const prodQuery = {
                                    dataSet: {
                                        rootEntity: "Produto",
                                        offsetPage: "0",
                                        criteria: { expression: `CODPROD = ${item.codprod}` },
                                        entity: { fieldset: { list: "DESCRPROD" } }
                                    }
                                };
                                const prodRes = await sankhyaService.callService('CRUDServiceProvider.loadRecords', prodQuery, 'mge');
                                const prodEnt = prodRes.responseBody?.entities?.entity;

                                if (prodEnt) {
                                    const prod = Array.isArray(prodEnt) ? prodEnt[0] : prodEnt;
                                    item.descricao = prod.f0?.['$'] || prod.DESCRPROD?.['$'] || prod.DESCRPROD;

                                    candidatePool.push(item);
                                    processedCodes.add(item.codprod);
                                }
                            } catch (err) {
                                console.log(`Error fetching detail for ${item.codprod}:`, err.message);
                            }
                        }
                    }
                }
            } else {
                console.log("Failed.");
            }
        }
    }

    console.log(`\n✅ Candidate Pool Built: ${candidatePool.length} unique products from history.`);
    console.log("--- Candidate Pool Sample (First 10) ---");
    candidatePool.slice(0, 10).forEach(c => console.log(`   [${c.codprod}] ${c.descricao} (R$ ${c.valorUnitario})`));
    console.log("----------------------------------------");


    // 3. Match Logic
    console.log("\n🤖 Matching Invoice Items...");

    const results = [];

    // Helper: Tokenize
    const tokenize = (str) => str.toUpperCase().replace(/[^A-Z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 1);

    for (const item of txtData.items) {
        let bestMatch = null;
        let highestScore = 0;
        let reasons = [];

        const itemTokens = tokenize(item.description);

        // A. Try Candidate Pool First (History Match)
        for (const candidate of candidatePool) {
            let score = 0;
            let currentReasons = [];
            const candDesc = candidate.descricao.toUpperCase();

            // 1. Keyword Intersection
            // We want to ensure MAJORITY of tokens match
            let matchCount = 0;
            itemTokens.forEach(token => {
                if (candDesc.includes(token)) matchCount++;
            });

            const matchRatio = matchCount / itemTokens.length;
            if (matchRatio > 0.5) {
                score += 50 * matchRatio;
                currentReasons.push(`Keywords (${Math.round(matchRatio * 100)}%)`);
            }

            // 2. Critical Specs (H4, 3500K, etc.) - The "Fuzzy Logic" part user asked for
            const criticalSpecs = ["H1", "H3", "H4", "H7", "H8", "H11", "H16", "H27", "HB3", "HB4", "HIR2", "3000K", "4300K", "6000K", "8000K", "12V", "24V"];

            let specMismatch = false;
            let specMatchCount = 0;

            criticalSpecs.forEach(spec => {
                const itemHas = item.description.toUpperCase().includes(spec);
                const candHas = candDesc.includes(spec);

                if (itemHas && candHas) {
                    score += 20; // Good!
                    specMatchCount++;
                } else if (itemHas && !candHas) {
                    // Critical Mismatch!
                    // If client says H4 and we say nothing or H7, that's bad.
                    // But maybe our description is generic.
                    // Let's check if candidate has a CONFLICTING spec from the same category
                    // E.g. Client=H4, Candidate=H7 -> Mismatch.
                    // Simplify: Penalize heavily if specific known keys are missing.
                    score -= 50;
                    specMismatch = true;
                } else if (!itemHas && candHas) {
                    // Candidate is more specific than request? Might be okay, but risky.
                }
            });

            if (specMatchCount > 0) currentReasons.push(`Specs (+${specMatchCount})`);

            // 3. Price Proximity
            // User specifically asked for this.
            if (item.price > 0 && candidate.valorUnitario > 0) {
                const diff = Math.abs(item.price - parseFloat(candidate.valorUnitario));
                const limit = item.price * 0.2; // 20% variance allowed?

                if (diff < 0.05) { // Exact price matched
                    score += 40;
                    currentReasons.push("Exact Price");
                } else if (diff < limit) {
                    score += 20;
                    currentReasons.push("Similiar Price");
                } else {
                    score -= 10; // Price divergence
                }
            }

            if (score > highestScore) {
                highestScore = score;
                bestMatch = candidate;
                reasons = currentReasons;
            }
        }

        // B. Fallback: If no history match (or low score), we would normally search the whole DB.
        // For this MVP, we just report matching status.

        let status = "UNMATCHED";
        if (highestScore >= 60) status = "MATCHED";
        else if (highestScore >= 20) status = "AMBIGUOUS";

        results.push({
            origCode: item.code,
            origDesc: item.description,
            mtchDesc: bestMatch ? bestMatch.descricao : "---",
            mtchCode: bestMatch ? bestMatch.codprod : "---",
            score: Math.round(highestScore),
            status: status,
            reasons: reasons.join(', ')
        });
    }

    // 4. Output Results Table
    console.log("\n📊 MATCHING RESULTS:\n");
    console.log(String("ORIG. DESC").padEnd(40) + " | " + String("MATCH CANDIDATE").padEnd(40) + " | SCORE | STATUS");
    console.log("-".repeat(110));

    results.forEach(r => {
        let line = r.origDesc.substring(0, 38).padEnd(40) + " | ";
        line += r.mtchDesc.substring(0, 38).padEnd(40) + " | ";
        line += String(r.score).padEnd(5) + " | " + r.status;
        console.log(line);
        if (r.status !== "UNMATCHED") {
            console.log(`   Reasons: ${r.reasons}`);
        }
    });
}

matchProducts();
