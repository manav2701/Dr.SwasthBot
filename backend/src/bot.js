require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose    = require('mongoose');
const { queryAgent } = require('./lyzrClient');
const logger      = require('./utils/logger');
const { findNearbyHospitals } = require('./utils/hospitalFinder');
const { searchDataset1, searchDataset2, getAllSymptoms, getTopSymptoms } = require('./utils/datasetHelper');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI        = process.env.MONGODB_URI || null;

if (!TELEGRAM_BOT_TOKEN) {
  logger.error("❗ TELEGRAM_BOT_TOKEN is missing in .env");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// MongoDB setup (unchanged)
let Conversation;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      logger.info("✅ Connected to MongoDB");
      const ConversationSchema = new mongoose.Schema({
        chatId:      { type: String, required: true, index: true },
        userMessage: { type: String, required: true },
        agentReply:  { type: String, required: true },
        timestamp:   { type: Date, default: Date.now }
      });
      Conversation = mongoose.model("Conversation", ConversationSchema);
    })
    .catch((err) => logger.error("❌ MongoDB connection error:", err.message));
} else {
  logger.warn("⚠️ MONGODB_URI not set. Conversations will not be saved.");
}

// ── In‐Memory Session Store ──
const userSessions = {};

// ── Helper Functions ──
function showStartButton(chatId) {
  bot.sendMessage(chatId, "👋 Hi! I am *Dr.SwasthBot 🇮🇳*, your friendly health assistant. Ready to begin a Health Risk screening for you or your loved ones?", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [ { text: "Start Health Screening", callback_data: "screen_health" } ]
      ]
    }
  });
}

function askAge(chatId) {
  userSessions[chatId].step = "ask_age";
  bot.sendMessage(chatId, "🔢 How old are you? (Please enter your age in years):");
}

function askGender(chatId) {
  userSessions[chatId].step = "ask_gender";
  bot.sendMessage(chatId, "🚻 Please select your gender:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Male",   callback_data: "gender_male" },
          { text: "Female", callback_data: "gender_female" },
          { text: "Other",  callback_data: "gender_other" }
        ]
      ]
    }
  });
}

function askWeight(chatId) {
  userSessions[chatId].step = "ask_weight";
  bot.sendMessage(chatId, "⚖️ Please enter your weight (in kg):");
}

function askHeight(chatId) {
  userSessions[chatId].step = "ask_height";
  bot.sendMessage(chatId, "📏 Please enter your height (in cm):");
}

function askBloodPressure(chatId) {
  userSessions[chatId].step = "ask_bp_know";
  bot.sendMessage(chatId, "🩸 Do you know your blood pressure? (If not, that's okay!)", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Yes", callback_data: "bp_yes" },
          { text: "No",  callback_data: "bp_no" }
        ]
      ]
    }
  });
}

function askBloodPressureValue(chatId) {
  userSessions[chatId].step = "ask_bp_value";
  bot.sendMessage(chatId, "Please enter your blood pressure as systolic/diastolic (e.g., 120/80):");
}

// --- Improved Symptom Selection (One-by-One, Top 10) ---
const SYMPTOM_LIST = getTopSymptoms(10);

function askNextSymptom(chatId) {
  const session = userSessions[chatId];
  if (!session.symptomIndex) session.symptomIndex = 0;
  if (!session.answers.symptoms) session.answers.symptoms = [];

  if (session.symptomIndex < SYMPTOM_LIST.length) {
    const symptom = SYMPTOM_LIST[session.symptomIndex];
    bot.sendMessage(chatId, `🤔 Are you experiencing *${symptom}*?`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Yes", callback_data: "symptom_yes" },
            { text: "No", callback_data: "symptom_no" }
          ]
        ]
      }
    });
  } else {
    session.step = "await_symptoms_input";
    askFreeTextSymptoms(chatId);
  }
}

function askFreeTextSymptoms(chatId) {
  userSessions[chatId].step = "await_symptoms_input";
  bot.sendMessage(chatId, "✍️ Please type any *other symptoms* or health concerns you have (or type 'Skip' if none):", { parse_mode: "Markdown" });
}

function offerDoctorConsultation(chatId, aiTriage) {
  let triageMsg = "Would you like to consult a doctor?";
  if (aiTriage) {
    triageMsg = `🩺 *AI Triage Recommendation:*\n${aiTriage}\n\nWould you like to consult a doctor? If yes, please share your location to find nearby hospitals.`;
  }
  bot.sendMessage(chatId, triageMsg, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: "📍 Share Location", request_location: true }],
        [{ text: "No, thanks" }]
      ],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });
}

// ── AI Triage Prompt Helper ──
async function getAITriageAndSpecialist(chatId, userSummary, dataset1Context, dataset2Context) {
  const triagePrompt =
`You are an AI medical assistant. Given the following user profile and symptoms, provide:
1. The most likely health risks or diseases (not just diabetes).
2. Whether the user needs *immediate* doctor consultation, *routine* checkup, or *self-care* is sufficient.
3. The type of specialist to consult (if any).
4. A short reason for your recommendation.

User summary:
${userSummary}

Context from Dataset1:
${dataset1Context}

Supplementary info from Dataset2:
${dataset2Context}

Format:
• Risks: <comma-separated>
• Urgency: <Immediate/Routine/Self-care>
• Specialist: <Type or 'None'>
• Reason: <Short reason>
`;

  const { success, reply } = await queryAgent(String(chatId), triagePrompt);
  return success && reply ? reply : null;
}

// ── Finalize and Analyze ──
async function finalizeAssessment(chatId) {
  const session = userSessions[chatId];
  const a = session.answers;

  // Calculate BMI
  let bmi = null;
  if (a.weight && a.height) {
    const weight = parseFloat(a.weight);
    const heightM = parseFloat(a.height) / 100;
    if (weight > 0 && heightM > 0) {
      bmi = (weight / (heightM * heightM)).toFixed(1);
    }
  }

  // Build user summary
  let userSummary = `Age: ${a.age}, Gender: ${a.gender}`;
  if (bmi) userSummary += `, BMI: ${bmi}`;
  if (a.bp) userSummary += `, Blood Pressure: ${a.bp}`;
  if (a.symptoms && a.symptoms.length) userSummary += `, Symptoms: ${a.symptoms.join(', ')}`;
  if (a.freeTextSymptoms && a.freeTextSymptoms.toLowerCase() !== "skip") userSummary += `, Additional: ${a.freeTextSymptoms}`;

  // Gather context from datasets
  const allSymptoms = [
    ...(a.symptoms || []),
    ...(a.freeTextSymptoms && a.freeTextSymptoms.toLowerCase() !== "skip" ? a.freeTextSymptoms.split(/[,.]/).map(s => s.trim()) : [])
  ].filter(Boolean);

  const dataset1Context = allSymptoms.map(searchDataset1).filter(x => x && x !== "No relevant info found.").join("\n");
  const dataset2Context = allSymptoms.map(searchDataset2).filter(x => x && x !== "No relevant info found.").join("\n");

  // Build prompt for Lyzr
  const userPrompt =
`You are a medical AI. Given the following user profile and symptoms, analyze and list the most likely health risks or diseases (not just diabetes), and suggest next steps.

User profile:
${userSummary}

Context from Dataset1:
${dataset1Context}

Supplementary info from Dataset2:
${dataset2Context}

Provide:
1) A concise risk assessment (list likely diseases/risks).
2) Evidence-based next steps.
3) If urgent, highlight in ALL CAPS.

Answer Format:
• Risks: <comma-separated>
• Plan: <short plan>
• Final line: “I used these data points: <…>” listing the specific bullet(s) from Dataset1 or Dataset2 you relied on.`;

  // Log the prompt
  console.log("──────────────────────────────────────────────────");
  console.log("Final Health Assessment Prompt sent to Lyzr.ai for chatId=", chatId, ":\n");
  console.log(userPrompt);
  console.log("──────────────────────────────────────────────────");

  // Call Lyzr.ai
  bot.sendChatAction(chatId, "typing");
  const { success, reply, raw } = await queryAgent(String(chatId), userPrompt);

  if (success && reply) {
    if (Conversation && mongoose.connection.readyState === 1) {
      await new Conversation({
        chatId: String(chatId),
        userMessage: userPrompt,
        agentReply: reply
      }).save();
    }
    bot.sendMessage(chatId, `✅ *Your Health Risk Assessment*\n\n${reply}`, { parse_mode: "Markdown" });

    // AI Triage & Specialist Recommendation
    const aiTriage = await getAITriageAndSpecialist(chatId, userSummary, dataset1Context, dataset2Context);
    offerDoctorConsultation(chatId, aiTriage);

  } else {
    bot.sendMessage(chatId, "❗ Sorry, I couldn’t get a response. Please try again later.");
    console.error("Lyzr.ai assessment error:", raw);
    offerDoctorConsultation(chatId, null);
  }

  delete userSessions[chatId];
}

// ── Main Handlers ──
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userSessions[chatId] = { step: "select_screening", answers: { symptoms: [] } };
  showStartButton(chatId);
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data   = callbackQuery.data;
  bot.answerCallbackQuery(callbackQuery.id);

  if (!userSessions[chatId]) {
    return bot.sendMessage(chatId, "Please type /start to begin the Health screening.");
  }
  const session = userSessions[chatId];

  switch (session.step) {
    case "select_screening":
      if (data === "screen_health") {
        session.step = "ask_age";
        askAge(chatId);
      }
      break;

    case "ask_gender":
      if (data.startsWith("gender_")) {
        session.answers.gender = data.replace("gender_", "");
        session.step = "ask_weight";
        askWeight(chatId);
      }
      break;

    case "ask_bp_know":
      if (data === "bp_yes") {
        session.step = "ask_bp_value";
        askBloodPressureValue(chatId);
      } else if (data === "bp_no") {
        session.answers.bp = "Not known";
        session.step = "await_symptom_yesno";
        session.symptomIndex = 0;
        askNextSymptom(chatId);
      }
      break;

    case "await_symptom_yesno":
      if (data === "symptom_yes" || data === "symptom_no") {
        const symptom = SYMPTOM_LIST[session.symptomIndex];
        if (data === "symptom_yes") {
          session.answers.symptoms.push(symptom);
        }
        session.symptomIndex += 1;
        if (session.symptomIndex < SYMPTOM_LIST.length) {
          askNextSymptom(chatId);
        } else {
          session.step = "await_symptoms_input";
          askFreeTextSymptoms(chatId);
        }
      }
      break;

    default:
      // For other steps, do nothing
      break;
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text && msg.text.trim();

  // 1. Handle location for hospital search (always allow, even if session is gone)
  if (msg.location) {
    const { latitude, longitude } = msg.location;
    bot.sendMessage(chatId, "🔎 Searching for nearby hospitals/clinics...");
    const hospitals = await findNearbyHospitals(latitude, longitude);
    if (hospitals.length > 0) {
      let reply = "🏥 *Nearby hospitals/clinics:*\n\n";
      hospitals.forEach((h, i) => {
        reply += `${i + 1}. *${h.name}*\n${h.address}\n`;
        if (h.phone && h.phone !== "Not available") {
          const phoneForLink = h.phone.replace(/[^+\d]/g, '');
          reply += `📞 [Call ${h.phone}](tel:${phoneForLink})\n\n`;
        } else {
          reply += `📞 Phone: Not available\n\n`;
        }
      });
      bot.sendMessage(chatId, reply, { parse_mode: "Markdown", disable_web_page_preview: true });
    } else {
      bot.sendMessage(chatId, "Sorry, I couldn't find any hospitals nearby.");
    }
    return;
  }

  // 2. If user says "No, thanks" after triage
  if (text && text.toLowerCase().includes("no, thanks")) {
    bot.sendMessage(chatId, "👍 Okay! If you need further help, just type /start.");
    return;
  }

  // 3. All other flows require a session
  if (!userSessions[chatId]) return;
  const session = userSessions[chatId];

  switch (session.step) {
    case "ask_age":
      if (/^\d+$/.test(text)) {
        session.answers.age = text;
        session.step = "ask_gender";
        askGender(chatId);
      } else {
        bot.sendMessage(chatId, "Please enter a valid age (number).");
      }
      break;

    case "ask_weight":
      if (/^\d+(\.\d+)?$/.test(text)) {
        session.answers.weight = text;
        session.step = "ask_height";
        askHeight(chatId);
      } else {
        bot.sendMessage(chatId, "Please enter a valid weight in kg (e.g., 70).");
      }
      break;

    case "ask_height":
      if (/^\d+(\.\d+)?$/.test(text)) {
        session.answers.height = text;
        // Calculate and show BMI immediately
        const weight = parseFloat(session.answers.weight);
        const heightM = parseFloat(text) / 100;
        if (weight > 0 && heightM > 0) {
          const bmi = (weight / (heightM * heightM)).toFixed(1);
          bot.sendMessage(chatId, `🧮 Your BMI is *${bmi}*`, { parse_mode: "Markdown" });
        }
        session.step = "ask_bp_know";
        askBloodPressure(chatId);
      } else {
        bot.sendMessage(chatId, "Please enter a valid height in cm (e.g., 170).");
      }
      break;

    case "ask_bp_value":
      if (/^\d{2,3}\/\d{2,3}$/.test(text)) {
        session.answers.bp = text;
        session.step = "await_symptom_yesno";
        session.symptomIndex = 0;
        askNextSymptom(chatId);
      } else {
        bot.sendMessage(chatId, "Please enter blood pressure in the format systolic/diastolic (e.g., 120/80).");
      }
      break;

    case "await_symptoms_input":
      session.answers.freeTextSymptoms = text;
      await finalizeAssessment(chatId);
      break;

    // Optionally, handle other steps if needed
  }
});

// Export for index.js
module.exports = {
  start: () => {
    logger.info("🤖 Dr.SwasthBot 🇮🇳 started in polling mode.");
  }
};