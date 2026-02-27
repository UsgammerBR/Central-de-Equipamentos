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
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      res.json(JSON.parse(data));
    } else {
      res.json({});
    }
  });

  app.post("/api/sync", (req, res) => {
    try {
      const size = JSON.stringify(req.body).length;
      console.log(`Received sync request. Data size: ${(size / 1024 / 1024).toFixed(2)} MB`);
      fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
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
