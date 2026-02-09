import express from "express";
import cors from "cors";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const CAMB_API_KEY = process.env.CAMB_API_KEY;

// Translate route
app.post("/translate", async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Create translation task
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

    if (!taskId) {
      return res.status(500).json({ error: "Translation task not created" });
    }

    // 2️⃣ Poll status
    let runId = null;

    while (!runId) {
      const statusRes = await fetch(
        `https://client.camb.ai/apis/translate/${taskId}`,
        { headers: { "x-api-key": CAMB_API_KEY } }
      );

      const status = await statusRes.json();

      if (status.status === "SUCCESS") {
        runId = status.run_id;
      } else if (status.status === "ERROR") {
        return res.status(500).json({ error: "Translation failed" });
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // 3️⃣ Get result
    const resultRes = await fetch(
      `https://client.camb.ai/apis/translation-result/${runId}`,
      { headers: { "x-api-key": CAMB_API_KEY } }
    );

    const result = await resultRes.json();

    res.json({
      translatedText: result.texts?.[0] || "",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Internal server error ${err}`});
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
