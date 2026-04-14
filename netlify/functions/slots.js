const { getStore } = require("@netlify/blobs");

const STORE_NAME = "pdl-scheduling";
const SLOTS_KEY = "slots";
const CONFIG_KEY = "config";

function createStore() {
  return getStore({
    name: STORE_NAME,
    siteID: "7818c8d8-6880-427b-9d2a-19cc288570c3",
    token: process.env.NETLIFY_API_TOKEN || "",
    consistency: "strong",
  });
}

module.exports.handler = async (event) => {
  var store = createStore();
  var method = event.httpMethod;
  var headers = { "Content-Type": "application/json" };

  if (method === "GET") {
    var config = await store.get(CONFIG_KEY, { type: "json" });
    var slots = await store.get(SLOTS_KEY, { type: "json" });
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ config: config || null, slots: slots || null }),
    };
  }

  if (method === "POST") {
    var body = JSON.parse(event.body);

    if (body.action === "publish") {
      await store.setJSON(CONFIG_KEY, body.config);
      await store.setJSON(SLOTS_KEY, body.slots);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) };
    }

    if (body.action === "book") {
      var slotId = body.slotId;
      var name = body.name;
      var slots = await store.get(SLOTS_KEY, { type: "json" });
      if (!slots || !slots[slotId]) {
        return { statusCode: 404, headers: headers, body: JSON.stringify({ error: "Horário não encontrado." }) };
      }
      if (slots[slotId].booked) {
        return { statusCode: 409, headers: headers, body: JSON.stringify({ error: "Este horário já foi reservado por outra pessoa. Escolha outro." }) };
      }
      slots[slotId] = {
        date: slots[slotId].date,
        time: slots[slotId].time,
        booked: true,
        name: name,
        bookedAt: new Date().toISOString(),
      };
      await store.setJSON(SLOTS_KEY, slots);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true, slot: slots[slotId] }) };
    }

    if (body.action === "reset") {
      await store.delete(CONFIG_KEY);
      await store.delete(SLOTS_KEY);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Ação inválida." }) };
  }

  return { statusCode: 405, headers: headers, body: "Method not allowed" };
};
