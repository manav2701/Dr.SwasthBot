/**
 * src/models/Conversation.js
 * --------------------------
 * Mongoose schema/model for saving each user-agent exchange.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ConversationSchema = new Schema({
  chatId:      { type: String, required: true, index: true },
  userMessage: { type: String, required: true },
  agentReply:  { type: String, required: true },
  timestamp:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', ConversationSchema);
