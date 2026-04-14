import { getStore } from "@netlify/blobs";

const STORE_NAME = "pdl-scheduling";
const SLOTS_KEY = "slots";
const CONFIG_KEY = "config";

export default async (req, context) => {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const method = req.method;

  // GET: return current slots and config
  if (method === "GET") {
    const config = await store.get(CONFIG_KEY, { type: "json" });
    const slots = await store.get(SLOTS_KEY, { type: "json" });
    return new Response(JSON.stringify({ config: config || null, slots: slots || null }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST: book a slot or publish slots
  if (method === "POST") {
    const body = await req.json();

    // Publish slots (admin)
    if (body.action === "publish") {
      await store.setJSON(CONFIG_KEY, body.config);
      await store.setJSON(SLOTS_KEY, body.slots);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Book a slot
    if (body.action === "book") {
      const { slotId, name } = body;
      const slots = await store.get(SLOTS_KEY, { type: "json" });
      if (!slots || !slots[slotId]) {
        return new Response(JSON.stringify({ error: "Horário não encontrado." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (slots[slotId].booked) {
        return new Response(JSON.stringify({ error: "Este horário já foi reservado por outra pessoa. Escolha outro." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
      slots[slotId] = {
        ...slots[slotId],
        booked: true,
        name: name,
        bookedAt: new Date().toISOString(),
      };
      await store.setJSON(SLOTS_KEY, slots);
      return new Response(JSON.stringify({ ok: true, slot: slots[slotId] }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Reset (admin)
    if (body.action === "reset") {
      await store.delete(CONFIG_KEY);
      await store.delete(SLOTS_KEY);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/slots",
};
