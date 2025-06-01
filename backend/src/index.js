/**
 * src/index.js
 * ------------
 * Entry point: starts Express server and initializes the Telegram bot (polling mode).
 */

require('dotenv').config();           // Load .env
const express  = require('express');
const logger   = require('./utils/logger');
const bot      = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser for JSON requests (for datasetRoutes)
app.use(express.json());

// Optional: Mount dataset search routes (if you want Data Connectors to hit these)
const datasetRoutes = require('./routes/datasetRoutes');
app.use('/api', datasetRoutes);

// Health-check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'UP' });
});

// Start Express
app.listen(PORT, () => {
  logger.info(`🌐 Express server running on port ${PORT}`);
});

// Start Telegram bot (polling)
bot.start();
