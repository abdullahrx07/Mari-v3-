const axios = require("axios");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

module.exports.config = {
 name: "install",
 version: "1.6.0",
 hasPermission: 2,
 credits: "rX Abdullah",
 description: "Install command via reply, code or URL with auto-load",
 usePrefix: true,
 commandCategory: "utility",
 usages: "!install | !install <code> | !install <link>",
 cooldowns: 5
};

// ===== Credit protection =====
(function () {
 const d = s => Buffer.from(s, "base64").toString();
 const author = d("clggQWJkdWxsYWg=");
 if (module.exports.config.credits !== author)
 throw new Error("❌ Credit modification is not allowed!");
})();

// ===== Auto load installed command =====
const loadInstalledCommand = ({ filename, api, threadID, messageID }) => {
 const logger = require(global.client.mainPath + "/utils/log");
 try {
 const filePath = path.join(__dirname, filename);
 delete require.cache[require.resolve(filePath)];

 const command = require(filePath);
 if (!command.config || !command.run)
 throw new Error("Invalid command structure!");

 // load dependencies
 if (command.config.dependencies) {
 for (const dep in command.config.dependencies) {
 global.nodemodule[dep] = require(dep);
 }
 }

 if (command.handleEvent)
 global.client.eventRegistered.push(command.config.name);

 global.client.commands.set(command.config.name, command);

 logger.loader(`[ INSTALL ] Loaded: ${command.config.name}`);
 api.sendMessage(
 `✅ Installed & loaded:\n${filename}`,
 threadID,
 messageID
 );
 } catch (e) {
 api.sendMessage(
 `❌ Auto-load failed:\n${e.message}`,
 threadID,
 messageID
 );
 }
};

// ===== Main command =====
module.exports.run = async ({ api, args, event }) => {
 try {
 let codeData = null;
 let url = null;

 const input = args.join(" ").trim();
 const urlRegex = /(https?:\/\/[^\s]+)/;
 const nameRegex = /Name\s*:\s*([^\n\r]+)/i;

 // MODE 3: link
 if (urlRegex.test(input)) {
 url = input.match(urlRegex)[0];
 }

 // MODE 2: code
 if (!url && input.includes("module.exports")) {
 codeData = input;
 }

 // MODE 1: reply message
 if (!url && !codeData && event.messageReply?.body) {
 const match = event.messageReply.body.match(urlRegex);
 if (match) url = match[0];
 }

 if (!url && !codeData) {
 return api.sendMessage(
 "❌ No code or URL found!\n\nUse:\n• Reply + !install\n• !install <code>\n• !install <link>",
 event.threadID,
 event.messageID
 );
 }

 // fetch from URL
 if (url) {
 try {
 const res = await axios.get(url);
 codeData = res.data;
 } catch (e) {
 return api.sendMessage(
 "❌ Failed to fetch code from URL!",
 event.threadID,
 event.messageID
 );
 }
 }

 // detect filename
 let filename;
 const sourceText = input || event.messageReply?.body || "";
 const nameMatch = sourceText.match(nameRegex);

 if (nameMatch) {
 filename = nameMatch[1].trim().replace(/\s+/g, "_") + ".js";
 } else if (url && path.basename(url).endsWith(".js")) {
 filename = path.basename(url);
 } else {
 filename = `install_${Date.now()}.js`;
 }

 if (filename.includes("..")) {
 return api.sendMessage("❌ Invalid filename!", event.threadID, event.messageID);
 }

 // syntax check
 try {
 new vm.Script(codeData);
 } catch (e) {
 return api.sendMessage(
 "❌ Syntax Error:\n" + e.message,
 event.threadID,
 event.messageID
 );
 }

 const savePath = path.join(__dirname, filename);

 // replace confirm
 if (fs.existsSync(savePath)) {
 return api.sendMessage(
 `⚠️ File exists: ${filename}\nReact ✅ to replace`,
 event.threadID,
 (err, info) => {
 global.client.handleReaction.push({
 name: "install",
 type: "replace",
 messageID: info.messageID,
 author: event.senderID,
 filename,
 code: codeData
 });
 }
 );
 }

 fs.writeFileSync(savePath, codeData, "utf-8");
 loadInstalledCommand({ filename, api, threadID: event.threadID, messageID: event.messageID });

 } catch (e) {
 console.error(e);
 api.sendMessage("❌ Install failed!", event.threadID, event.messageID);
 }
};

// ===== Reaction handler =====
module.exports.handleReaction = async ({ api, event, handleReaction }) => {
 if (handleReaction.name !== "install") return;
 if (event.userID !== handleReaction.author) return;
 if (event.reaction !== "✅") return;

 const savePath = path.join(__dirname, handleReaction.filename);
 fs.writeFileSync(savePath, handleReaction.code, "utf-8");

 try { api.unsendMessage(handleReaction.messageID); } catch {}

 loadInstalledCommand({
 filename: handleReaction.filename,
 api,
 threadID: event.threadID,
 messageID: event.messageID
 });
};
