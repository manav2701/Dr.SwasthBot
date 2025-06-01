/**
 * src/lyzrClient.js
 * -----------------
 * Simple wrapper around Lyzr.ai’s inference endpoint.
 */

require('dotenv').config();
const axios = require('axios');
const logger = require('./utils/logger');

const LYZR_API_KEY = process.env.LYZR_API_KEY;
const AGENT_ID    = process.env.LYZR_AGENT_ID;

// Lyzr.ai inference endpoint
const LYZR_API_URL = 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/';

async function queryAgent(userId, userMessage) {
  /**
   * Sends userMessage to Lyzr.ai agent and returns { success, reply, raw }
   */
  try {
    const payload = {
      user_id:    userId,      // used by Lyzr.ai for session/memory
      agent_id:   AGENT_ID,
      session_id: userId,      // reusing userId as session ID
      message:    userMessage
    };

    const response = await axios.post(
      LYZR_API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LYZR_API_KEY
        }
      }
    );

    if (response.status === 200 && response.data) {
      // Lyzr.ai returns { response: "<text>", module_outputs: { … } }
      const agentReply = response.data.response ?? null;
      return {
        success: agentReply !== null,
        reply:   agentReply,
        raw:     response.data
      };
    } else {
      logger.error('❌ Non-200 or malformed response from Lyzr.ai:', response.status, response.data);
      return { success: false, reply: null, raw: response.data };
    }
  } catch (err) {
    logger.error('❌ Error querying Lyzr.ai:', err.response?.data || err.message);
    return { success: false, reply: null, raw: err.response?.data || err.message };
  }
}

module.exports = { queryAgent };
