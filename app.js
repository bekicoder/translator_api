import express from "express";
import cors from "cors";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const CAMB_API_KEY = process.env.CAMB_API_KEY;

app.get("/test", (req, res) => {
  res.json({ CAMB_API_KEY });
});

// Translate route
app.post("/translate", async (req, res) => {
  const { text, targetLang } = req.body;

  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let taskId: string;
  try {
    // 1️⃣ Create translation task
    const createRes = await fetch("https://client.camb.ai/apis/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CAMB_API_KEY,
      },
      body: JSON.stringify({
        target_language: Number(targetLang), // ensure numeric
        texts: [text],
      }),
    });

    const createData = await createRes.json();
    taskId = createData.task_id;

    if (!taskId) {
      return res.status(500).json({
        error: "Translation task not created",
        raw: createData,
      });
    }
  } catch (err) {
    console.error("Error creating translation task:", err);
    return res.status(500).json({ error: "Error creating task", raw: err });
  }

  let runId: string | null = null;
  try {
    // 2️⃣ Poll status
    while (!runId) {
      const statusRes = await fetch(
        `https://client.camb.ai/apis/translate/${taskId}`,
        { headers: { "x-api-key": CAMB_API_KEY } }
      );

      const status = await statusRes.json();

      if (status.status === "SUCCESS") {
        runId = status.run_id;
      } else if (status.status === "ERROR") {
        return res.status(500).json({
          error: "Translation failed",
          raw: status,
        });
      } else {
        // still running, wait 1s
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } catch (err) {
    console.error("Error polling translation status:", err);
    return res.status(500).json({ error: "Error polling status", raw: err });
  }

  try {
    // 3️⃣ Get result
    const resultRes = await fetch(
      `https://client.camb.ai/apis/translation-result/${runId}`,
      { headers: { "x-api-key": CAMB_API_KEY } }
    );

    const result = await resultRes.json();

    res.json({
      translatedText: result.texts?.[0] || "",
      raw: result,
    });
  } catch (err) {
    console.error("Error fetching translation result:", err);
    return res.status(500).json({ error: "Error fetching result", raw: err });
  }
});
// translate proxy to prevent cors orgin policiy 
app.post("/translate-proxy", async (req, res) => {
  try {
    const response = await fetch("https://translator-api-ashy.vercel.app/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
