import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));
app.options("*", cors());

const CAMB_API_KEY = process.env.CAMB_API_KEY;

app.post("/translate", async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) return res.status(400).json({ error: "Missing fields" });

    // Node.js talks to external API (no CORS problem)
    const createRes = await fetch("https://client.camb.ai/apis/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CAMB_API_KEY,
      },
      body: JSON.stringify({ target_language: Number(targetLang), texts: [text] }),
    });

    const createData = await createRes.json();
    const taskId = createData.task_id;
    if (!taskId) return res.status(500).json({ error: "Task not created", raw: createData });

    // Poll status
    let runId = null;
    while (!runId) {
      const statusRes = await fetch(`https://client.camb.ai/apis/translate/${taskId}`, {
        headers: { "x-api-key": CAMB_API_KEY },
      });
      const status = await statusRes.json();
      if (status.status === "SUCCESS") runId = status.run_id;
      else if (status.status === "ERROR") return res.status(500).json({ error: "Translation failed", raw: status });
      else await new Promise((r) => setTimeout(r, 1000));
    }

    const resultRes = await fetch(`https://client.camb.ai/apis/translation-result/${runId}`, {
      headers: { "x-api-key": CAMB_API_KEY },
    });
    const result = await resultRes.json();

    res.json({ translatedText: result.texts?.[0] || "", raw: result });
  } catch (err) {
    res.status(500).json({ error: err.message, raw: err });
  }
});

app.listen(8000, () => console.log("Server running on port 8000"));
