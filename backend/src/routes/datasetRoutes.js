/**
 * src/routes/datasetRoutes.js
 * ---------------------------
 * Exposes two endpoints for searching dataset1 and dataset2.
 * Useful if you want to configure Lyzr.ai Data Connectors to call these endpoints.
 */

const express = require('express');
const router  = express.Router();
const { searchDataset1, searchDataset2 } = require('../utils/datasetHelper');

// GET /api/dataset1/search?q=your+query
router.get('/dataset1/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ success: false, error: "Missing 'q' parameter" });
  }
  const results = searchDataset1(q);
  res.json({ success: true, results });
});

// GET /api/dataset2/search?q=your+query
router.get('/dataset2/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ success: false, error: "Missing 'q' parameter" });
  }
  const results = searchDataset2(q);
  res.json({ success: true, results });
});

module.exports = router;
