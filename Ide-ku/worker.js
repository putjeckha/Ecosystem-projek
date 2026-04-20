export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { title, notes, category, priority, mode, systemPrompt, userPrompt } = body;

      if (!title) {
        return new Response(JSON.stringify({ error: "Title is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let messages;
      let maxTokens;

      if (mode === "breakdown" && systemPrompt && userPrompt) {
        messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ];
        maxTokens = 400;
      } else {
        const prompt = `Tulis ulang ide berikut menjadi 2-3 kalimat yang lebih jelas dan konkret.\n\nJudul: ${title}\nKategori: ${category || "-"}\nCatatan: ${notes || "-"}\n\nBatasan:\n- Maksimal 3 kalimat\n- Bahasa Indonesia santai\n- Tanpa bullet point`;
        messages = [{ role: "user", content: prompt }];
        maxTokens = 120;
      }

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: maxTokens,
          temperature: 0.5,
          messages,
        }),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        return new Response(JSON.stringify({ error: "AI request failed", detail: errText }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await groqRes.json();
      const result = data.choices?.[0]?.message?.content?.trim() || "";

      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Internal error", detail: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};