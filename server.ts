import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { setupMultiplayer } from './src/server/index.ts';

async function startServer() {
  // Start Express on port 3000
  const app = express();
  const PORT = 3000;
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });

  // Start WebSocket server using the same HTTP server
  try {
    setupMultiplayer(server);
  } catch (error) {
    console.error('Failed to setup multiplayer:', error);
  }

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  setInterval(() => {
    fetch('http://localhost:3000/api/health').catch(() => {}); // Minimal impact "poke"
  }, 30000);
  
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer();
