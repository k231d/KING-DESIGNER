import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist/public'), {
  // Cache static files in production
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : undefined,
  etag: false
}));

// Remove deprecated URL parsing by using modern alternatives
app.use((req: Request, res: Response, next: NextFunction) => {
  // Use the built-in req.url which is already parsed
  // Avoid using url.parse() which is deprecated
  try {
    const requestUrl = new URL(req.url, `http://${req.get('host')}`);
    // Continue with modern URL API
    next();
  } catch (error) {
    next();
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

// API routes
app.get('/api/config', (req: Request, res: Response) => {
  res.json({ 
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    environment: process.env.NODE_ENV
  });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌍 URL: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
