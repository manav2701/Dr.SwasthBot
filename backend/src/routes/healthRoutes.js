/**
 * src/routes/healthRoutes.js
 * --------------------------
 * Exposes two routes:
 * 1. GET  /api/chats            → returns a list of distinct chatIds
 * 2. GET  /api/chats/:chatId    → returns all messages for that chatId
 */

const express = require('express');
const router  = express.Router();

const mongoose = require('mongoose');
let Conversation;
try {
  Conversation = mongoose.model('Conversation');
} catch {
  // If the model isn’t defined (because no MongoDB), skip
  Conversation = null;
}

// GET /api/chats
router.get('/chats', async (req, res) => {
  if (!Conversation) {
    return res.status(503).json({ success: false, error: 'MongoDB not configured.' });
  }
  try {
    const chats = await Conversation.distinct('chatId');
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chats/:chatId
router.get('/chats/:chatId', async (req, res) => {
  if (!Conversation) {
    return res.status(503).json({ success: false, error: 'MongoDB not configured.' });
  }
  const { chatId } = req.params;
  try {
    const messages = await Conversation.find({ chatId }).sort({ timestamp: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
