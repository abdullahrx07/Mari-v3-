const axios = require("axios");

module.exports.config = {
  name: "truthordare",
  version: "2.3.0",
  hasPermssion: 0,
  credits: "rX Abdullah",
  description: "Play truth or dare using questions from Render API and SimSimi for replies (no countdown)",
  commandCategory: "fun",
  usages: "[optional: truth/dare]",
  cooldowns: 5,
};

let simsim = "https://rx-simisimi-api-tllc.onrender.com"; // SimSimi API URL

module.exports.run = async function({ api, event, args, Users }) {
  const { threadID, messageID, senderID } = event;
  const name = await Users.getNameUser(senderID);

  const baseAPI = "https://true-false-api-9cq3.onrender.com/truthdare";

  // Determine type
  const typeInput = args[0]?.toLowerCase();
  const type = typeInput === "truth" || typeInput === "dare"
    ? typeInput
    : Math.random() < 0.5
      ? "truth"
      : "dare";

  try {
    const res = await axios.get(`${baseAPI}/${type}`, { timeout: 10000 });
    const question = res.data?.question || "⚠️ Couldn't get question from API.";

    const msg = `${type === "truth" ? "🟢 𝗧𝗥𝗨𝗧𝗛 𝗧𝗜𝗠𝗘" : "🔴 𝗗𝗔𝗥𝗘 𝗧𝗜𝗠𝗘"}\n` +
      `➤ ${name}, ${type === "truth" ? "answer this question honestly" : "complete this dare"}:\n` +
      `${question}\n\n💬 Reply to this message with your ${type === "truth" ? "answer" : "proof"}.`;

    api.sendMessage(msg, threadID, (err, info) => {
      if (!err) {
        global.client.handleReply.push({
          name: module.exports.config.name,
          messageID: info.messageID,
          author: senderID,
          authorName: name,
          type
        });
      }
    }, messageID);

  } catch (err) {
    console.error("DEBUG: API fetch error:", err.message);
    api.sendMessage(`⚠️ Failed to fetch question from API.\nError: ${err.message}`, threadID, messageID);
  }
};

module.exports.handleReply = async function({ api, event, handleReply, Users }) {
  const { threadID, messageID, senderID, body } = event;

  if (senderID !== handleReply.author)
    return api.sendMessage("🚫 Only the selected player can reply!", threadID, messageID);

  const senderName = await Users.getNameUser(senderID);

  if (!simsim) return api.sendMessage("❌ SimSimi API not loaded yet.", threadID, messageID);

  try {
    const encodedText = encodeURIComponent(body.trim());
    const encodedName = encodeURIComponent(senderName);

    const res = await axios.get(`${simsim}/simsimi?text=${encodedText}&senderName=${encodedName}`, {
      timeout: 10000
    });

    const reply = res.data?.response;
    const finalReply = reply && reply.length > 0 ? reply : "🤖 Hmm, SimSimi is silent this time 😅";

    const msg = `ℹ️ 𝐀𝐍𝐒𝐖𝐄𝐑 𝐑𝐄𝐂𝐄𝐈𝐕𝐄𝐃\n` +
      `➤ ${handleReply.authorName}\n` +
      `💬 "Your reply: "${body}"\n` +
      `💬 ${finalReply}"`;

    return api.sendMessage(msg, threadID, messageID);

  } catch (err) {
    console.error("DEBUG: SimSimi API error:", err.message);
    return api.sendMessage(`⚠️ Failed to fetch reply from SimSimi.\nError: ${err.message}`, threadID, messageID);
  }
};
