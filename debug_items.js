const sankhyaService = require('./sankhyaService');

async function debugItems() {
    console.log("🔎 Debugging Items for NUNOTA 21668...");
    // 21668 was the NUNOTA found in previous logs

    try {
        const result = await sankhyaService.getOrderItems(21668);
        console.log("Success:", result.success);
        console.log("Message:", result.message);

        if (result.data && result.data.items) {
            console.log("Items found:", result.data.items.length);
            console.log("First Item Raw:", JSON.stringify(result.data.items[0], null, 2));
        } else {
            console.log("No items in data.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

debugItems();
