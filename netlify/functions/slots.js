const { getStore } = require("@netlify/blobs");

const STORE_NAME = "pdl-scheduling";
const SLOTS_KEY = "slots";
const CONFIG_KEY = "config";

exports.handler = async (event) => {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const method = event.httpMethod;
  const headers = { "Content-Type": "application/json" };

  // GET: return current slots and config
  if (method === "GET") {
    const config = await store.get(CONFIG_KEY, { type: "json" });
    const slots = await store.get(SLOTS_KEY, { type: "json" });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ config: config || null, slots: slots || null }),
    };
  }

  // POST: book a slot or publish slots
  if (method === "POST") {
    const body = JSON.parse(event.body);

    // Publish slots (admin)
    if (body.action === "publish") {
      await store.setJSON(CONFIG_KEY, body.config);
      await store.setJSON(SLOTS_KEY, body.slots);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // Book a slot
    if (body.action === "book") {
      const { slotId, name } = body;
      const slots = await store.get(SLOTS_KEY, { type: "json" });
      if (!slots || !slots[slotId]) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Horário não encontrado." }) };
      }
      if (slots[slotId].booked) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: "Este horário já foi reservado por outra pessoa. Escolha outro." }) };
      }
      slots[slotId] = {
        ...slots[slotId],
        booked: true,
        name: name,
        bookedAt: new Date().toISOString(),
      };
      await store.setJSON(SLOTS_KEY, slots);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, slot: slots[slotId] }) };
    }

    // Reset (admin)
    if (body.action === "reset") {
      await store.delete(CONFIG_KEY);
      await store.delete(SLOTS_KEY);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Ação inválida." }) };
  }

  return { statusCode: 405, headers, body: "Method not allowed" };
};
