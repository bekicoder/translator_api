import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const CAMB_API_KEY = process.env.CAMB_API_KEY;

// 1️⃣ Independent translate function
async function translate(text: string, targetLang: number) {
  if (!text || !targetLang) throw new Error("Missing required parameters");

  // Create translation task
  const createRes = await fetch("https://client.camb.ai/apis/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CAMB_API_KEY,
    },
    body: JSON.stringify({
      target_language: targetLang,
      texts: [text],
    }),
  });

  const createData = await createRes.json();
  const taskId = createData.task_id;

  if (!taskId) throw new Error("Translation task not created");

  // Poll status
  let runId: string | null = null;
  while (!runId) {
    const statusRes = await fetch(
      `https://client.camb.ai/apis/translate/${taskId}`,
      { headers: { "x-api-key": CAMB_API_KEY } }
    );
    const status = await statusRes.json();

    if (status.status === "SUCCESS") runId = status.run_id;
    else if (status.status === "ERROR") throw new Error("Translation failed");
    else await new Promise((r) => setTimeout(r, 1000));
  }

  // Get result
  const resultRes = await fetch(
    `https://client.camb.ai/apis/translation-result/${runId}`,
    { headers: { "x-api-key": CAMB_API_KEY } }
  );
  const result = await resultRes.json();

  return result.texts?.[0] || "";
}

// 2️⃣ Translate route just calls the function
app.post("/translate", async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const translatedText = await translate(text, Number(targetLang));
    res.json({ translatedText });
  } catch (err: any) {
    console.error("Translate route error:", err);
    res.status(500).json({ error: err.message, raw: err });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
