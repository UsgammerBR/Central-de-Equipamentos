import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const DATA_FILE = path.join(process.cwd(), "data.json");

  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.get("/api/data", (req, res) => {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ error: "Email required" });

    const userFile = path.join(process.cwd(), `data_${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
    
    if (fs.existsSync(userFile)) {
      const data = fs.readFileSync(userFile, "utf-8");
      res.json(JSON.parse(data));
    } else {
      res.json({});
    }
  });

  app.post("/api/sync", (req, res) => {
    try {
      const { email, data } = req.body;
      if (!email) return res.status(400).json({ error: "Email required" });

      const userFile = path.join(process.cwd(), `data_${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
      
      const size = JSON.stringify(data).length;
      console.log(`Received sync request for ${email}. Data size: ${(size / 1024 / 1024).toFixed(2)} MB`);
      fs.writeFileSync(userFile, JSON.stringify(data, null, 2));
      res.json({ status: "ok" });
    } catch (err) {
      console.error("Sync error:", err);
      res.status(500).json({ error: "Failed to sync", details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
