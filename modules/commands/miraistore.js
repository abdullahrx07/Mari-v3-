const fs = require("fs");
const path = require("path");
const axios = require("axios");

const API_BASE = "https://mirai-store.vercel.app";
const ADMINS = ["61587645204496", "61586508239289"]; // তোর নতুন UID এখানে বসানো হয়েছে
const userSeenNoti = new Map();

module.exports.config = {
 name: "miraistore",
 aliases: ["ms", "shop"],
 version: "2.9.0",
 hasPermission: 2,
 credits: "rX & Maria",
 description: "Mirai Command Store (Search, Like, Upload, Install, Delete, Trending, List)",
 commandCategory: "system",
 usages:
 "!ms <id | name | category | author>\n" +
 "!ms n\n" +
 "!ms install <id>\n" +
 "!ms like <id>\n" +
 "!ms trending\n" +
 "!ms upload <commandName>\n" +
 "!ms delete <id> <secret>\n" +
 "!ms list [page]",
 cooldowns: 3
};

module.exports.onLoad = function() {
 if (!global.miraistorePages) global.miraistorePages = new Map();
};

// আজকের আপডেট চেক করার ফাংশন
async function getTodayUpdates() {
 try {
 const res = await axios.get(`${API_BASE}/miraistore/list?limit=50`);
 const allCmds = res.data.commands || [];
 const today = new Date().toDateString();
 return allCmds.filter(cmd => new Date(cmd.uploadDate).toDateString() === today);
 } catch (e) { return []; }
}

async function sendSearchPage(api, threadID, query, page, limit = 5) {
 const offset = (page - 1) * limit;
 try {
 const res = await axios.get(`${API_BASE}/miraistore/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`);
 const data = res.data;
 if (!data || !Array.isArray(data.commands) || data.commands.length === 0) {
 return api.sendMessage("❌ No results found for this page.", threadID);
 }

 const commands = data.commands;
 const total = data.total;
 const totalPages = Math.ceil(total / limit);

 let msg = `📂 Search Results (${total})\n\n`;
 commands.forEach(cmd => {
 msg += `╭─‣ ${cmd.name} 〄\n`;
 msg += `├‣ ID : ${cmd.id}\n`;
 msg += `├‣ Author : ${cmd.author}\n`;
 msg += `├‣ Category : ${cmd.category}\n`;
 msg += `╰────────────◊\n`;
 msg += ` ✰ Upload : ${new Date(cmd.uploadDate || Date.now()).toDateString()}\n\n`;
 });

 if (totalPages > 1) {
 msg += `Page ${page}/${totalPages}\nReply "page <number>" or react ➡️ to go to the next page.`;
 }

 const infoMsg = await new Promise((resolve, reject) => {
 api.sendMessage(msg.trim(), threadID, (err, info) => {
 if (err) reject(err);
 else resolve(info);
 });
 });

 if (totalPages > 1) {
 const handleData = {
 name: this.config.name,
 messageID: infoMsg.messageID,
 author: infoMsg.senderID,
 query, page, totalPages, limit
 };
 global.client.handleReply.push(handleData);
 global.client.handleReaction.push(handleData);
 }
 } catch (err) {
 console.error("SEARCH PAGE ERROR:", err.message);
 api.sendMessage("❌ Search API error.", threadID);
 }
}

// ================= [ SEPARATE HANDLERS ] =================

module.exports.handleReaction = async function({ api, event, handleReaction }) {
 if (event.reaction !== "➡️" || event.userID === api.getCurrentUserID()) return;
 const { threadID, messageID } = event;
 const { query, page, totalPages, limit } = handleReaction;
 
 if (page < totalPages) {
 api.unsendMessage(messageID);
 await sendSearchPage.call(this, api, threadID, query, page + 1, limit);
 }
};

module.exports.handleReply = async function({ api, event, handleReply }) {
 const { threadID, body } = event;
 const { query, totalPages, limit } = handleReply;
 const match = body.match(/^page (\d+)$/i);
 
 if (match) {
 const newPage = parseInt(match[1]);
 if (newPage >= 1 && newPage <= totalPages) {
 api.unsendMessage(handleReply.messageID);
 await sendSearchPage.call(this, api, threadID, query, newPage, limit);
 }
 }
};

// ================= [ MAIN RUN ] =================

module.exports.run = async function({ api, event, args }) {
 const { threadID, senderID } = event;
 const sub = args[0] ? args[0].toLowerCase() : null;

 // নোটিফিকেশন সিস্টেম (!ms n)
 if (sub === "n" || sub === "notification") {
 const updates = await getTodayUpdates();
 if (updates.length === 0) return api.sendMessage("📅 Today no updates.", threadID);
 let msg = `📂 **Today's Updates**\n━━━━━━━━━━━━━━━━━━\n`;
 updates.forEach(cmd => msg += `╭─‣ ${cmd.name}\n├‣ ID: ${cmd.id}\n├‣ Author: ${cmd.author}\n╰────────────◊\n\n`);
 return api.sendMessage(msg, threadID);
 }

 // UID ভিত্তিক অটো-নোটিফিকেশন
 if (!sub) {
 const updates = await getTodayUpdates();
 if (updates.length > 0 && !userSeenNoti.get(senderID)) {
 let n = `🔔 [ NOTIFICATION ]\nToday ${updates.length} update(s)!\n━━━━━━━━━━━━━━━━━━\n`;
 updates.forEach(f => n += ` ‣ ${f.name} (ID: ${f.id})\n`);
 n += `\n(Type "!ms n" for info or "!ms" again for menu)`;
 userSeenNoti.set(senderID, true);
 return api.sendMessage(n, threadID);
 }
 return api.sendMessage(
 "📦 Mirai Store\n\nUsage:\n" +
 "• !ms <id | name | category | author>\n" +
 "• !ms n (Noti)\n" +
 "• !ms install <id>\n" +
 "• !ms like <id>\n" +
 "• !ms trending\n" +
 "• !ms upload <commandName>\n" +
 "• !ms delete <id> <secret>\n" +
 "• !ms list [page]",
 threadID
 );
 }

 // ================= UPLOAD =================
 if (sub === "upload") {
 if (!ADMINS.includes(senderID)) return api.sendMessage("❌ You are not allowed to upload.", threadID);
 const cmdName = args[1];
 if (!cmdName) return api.sendMessage("📁 Please provide a command name.", threadID);
 const commandsPath = path.join(__dirname, "..", "commands");
 const filePath1 = path.join(commandsPath, cmdName);
 const filePath2 = path.join(commandsPath, cmdName + ".js");
 let fileToRead = fs.existsSync(filePath1) ? filePath1 : (fs.existsSync(filePath2) ? filePath2 : null);
 if (!fileToRead) return api.sendMessage("❌ File not found in `commands` folder.", threadID);
 try {
 const data = fs.readFileSync(fileToRead, "utf8");
 try { new Function(data); } catch (e) { return api.sendMessage(`❌ Syntax Error:\n${e.message}`, threadID); }
 const infoMsg = await new Promise(resolve => api.sendMessage("📤 Uploading, please wait...", threadID, (err, info) => resolve(info)));
 const pasteRes = await axios.post("https://pastebin-api.vercel.app/paste", { text: data });
 setTimeout(() => api.unsendMessage(infoMsg.messageID), 1000);
 if (!pasteRes.data?.id) return api.sendMessage("⚠️ Upload failed at PasteBin.", threadID);
 const rawUrl = `https://pastebin-api.vercel.app/raw/${pasteRes.data.id}`;
 const res = await axios.post(`${API_BASE}/miraistore/upload`, { rawUrl });
 if (res.data?.id) {
 userSeenNoti.clear();
 return api.sendMessage(`✅ Upload Successful!\nID: ${res.data.id}\nURL: ${rawUrl}`, threadID);
 }
 } catch (err) { return api.sendMessage("❌ Upload failed.", threadID); }
 }

 // ================= DELETE =================
 if (sub === "delete") {
 if (!ADMINS.includes(senderID)) return api.sendMessage("❌ No permission.", threadID);
 const id = args[1]; const secret = args[2];
 if (!id || !secret) return api.sendMessage("❌ Usage: !ms delete <id> <secret>", threadID);
 try {
 const res = await axios.post(`${API_BASE}/miraistore/delete/${id}`, { secret });
 return api.sendMessage(res.data?.error ? `❌ ${res.data.error}` : `🗑️ Deleted ID: ${id}`, threadID);
 } catch { return api.sendMessage("❌ Delete API error.", threadID); }
 }

 // ================= LIKE =================
 if (sub === "like") {
 const id = args[1]; if (!id) return api.sendMessage("❌ Usage: !ms like <id>", threadID);
 try {
 const res = await axios.post(`${API_BASE}/miraistore/like/${id}`, { userID: senderID });
 if (res.data?.message) return api.sendMessage("⚠️ Already liked.", threadID);
 return api.sendMessage(`❤️ Liked!\nTotal Likes: ${res.data.likes}`, threadID);
 } catch { return api.sendMessage("❌ Like API error.", threadID); }
 }

 // ================= INSTALL =================
 if (sub === "install") {
 const id = args[1]; if (!id) return api.sendMessage("❌ Usage: !ms install <id>", threadID);
 try {
 const res = await axios.get(`${API_BASE}/miraistore/search?q=${encodeURIComponent(id)}`);
 const data = res.data;
 const cmd = Array.isArray(data.commands || data) ? (data.commands || data).find(c => String(c.id) === String(id)) : data;
 if (!cmd || !cmd.rawCode) return api.sendMessage("❌ rawCode not found.", threadID);
 const fileName = (cmd.name || `ms_${id}`).replace(/\s+/g, "_") + ".js";
 fs.writeFileSync(path.join(__dirname, fileName), cmd.rawCode, "utf-8");
 return api.sendMessage(`✅ Installed & Loaded Successfully!\n📦 Name: ${cmd.name}\n🆔 ID: ${id}`, threadID);
 } catch (err) { return api.sendMessage("❌ Install failed.", threadID); }
 }

 // ================= TRENDING =================
 if (sub === "trend" || sub === "trending") {
 try {
 const res = await axios.get(`${API_BASE}/miraistore/trending?limit=3`);
 if (!res.data.length) return api.sendMessage("❌ No trending commands.", threadID);
 let msg = "🔥 Top 3 Trending Mirai Commands 🔥\n\n";
 res.data.forEach((cmd, i) => msg += `╭─‣ ${cmd.name}${i === 0 ? " 🏆" : ""}\n├‣ Likes : ❤️ ${cmd.likes}\n├‣ ID : ${cmd.id}\n╰────────────◊\n\n`);
 return api.sendMessage(msg.trim(), threadID);
 } catch { return api.sendMessage("❌ Trending API error.", threadID); }
 }

 // ================= LIST =================
 if (sub === "list" || sub === "ls") {
 let page = Number(args[1]) || 1;
 try {
 const res = await axios.get(`${API_BASE}/miraistore/list?limit=20&offset=${(page - 1) * 20}`);
 const data = res.data;
 if (!data.commands.length) return api.sendMessage("❌ No commands found.", threadID);
 let msg = `📂 Miraistore List — Page ${page}\n\n`;
 data.commands.forEach(cmd => msg += `╭─‣ ${cmd.name}\n├‣ ID : ${cmd.id}\n╰────────────◊\n\n`);
 return api.sendMessage(msg.trim(), threadID);
 } catch (err) { return api.sendMessage("❌ List API error.", threadID); }
 }

    // ================= SEARCH =================
  const query = args.join(" ");
  try {
    const res = await axios.get(`${API_BASE}/miraistore/search?q=${encodeURIComponent(query)}`);
    const data = res.data;
    if (!data || data.message) return api.sendMessage("❌ Command not found.", threadID);

    if (!isNaN(query) && !Array.isArray(data)) {
      const message = `╭─‣ Name : ${data.name}
├‣ Author : ${data.author}
├‣ Version : ${data.version || "N/A"}
├‣ Category : ${data.category}
├‣ Views : ${data.views}
├‣ Likes : ❤️ ${data.likes}
├‣ ID : ${data.id}
╰────────────◊
⭔ Description: ${data.description || "No description"}
⭔ Upload : ${new Date(data.uploadDate || Date.now()).toDateString()}
🌐 URL : ${data.rawUrl}`;
      return api.sendMessage(message, threadID);
    } else {
      await sendSearchPage(api, threadID, query, 1);
    }
  } catch (err) {
    console.error("SEARCH ERROR:", err.message, err.response?.data);
    return api.sendMessage("❌ Search API error.", threadID);
  }
};
