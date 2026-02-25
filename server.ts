import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Simple file-based database for persistence in this environment
  const DB_PATH = path.resolve("./data.json");
  
  const readDB = () => {
    try {
      if (fs.existsSync(DB_PATH)) {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      }
    } catch (e) {
      console.error("Error reading DB", e);
    }
    return {};
  };

  const writeDB = (data: any) => {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("Error writing DB", e);
    }
  };

  // API routes
  app.get("/api/data", (req, res) => {
    res.json(readDB());
  });

  app.post("/api/sync", (req, res) => {
    const clientData = req.body;
    const serverData = readDB();
    
    // Simple merge logic: client data is authoritative for this single-user app
    // In a multi-user app, we would merge based on timestamps per item
    writeDB(clientData);
    res.json({ status: "success", message: "Data synchronized" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
