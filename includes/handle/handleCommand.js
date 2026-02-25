const fs = require("fs");
const path = require("path");
const stringSimilarity = require("string-similarity");
const moment = require("moment-timezone");
const logger = require("../../utils/log.js");
const axios = require("axios");


module.exports = function ({ api, models, Users, Threads, Currencies }) {

  const vipFilePath = path.join(__dirname, "../../modules/commands/rx/vip.json");
  const vipModePath = path.join(__dirname, "../../modules/commands/rx/vipMode.json");

  const loadVIP = () => {
    if (!fs.existsSync(vipFilePath)) return [];
    const data = fs.readFileSync(vipFilePath, "utf-8");
    return JSON.parse(data);
  };

  const loadVIPMode = () => {
    if (!fs.existsSync(vipModePath)) return false;
    const data = fs.readFileSync(vipModePath, "utf-8");
    const parsed = JSON.parse(data);
    return parsed.vipMode || false;
  };

   // ===== PREMIUM SYSTEM =====
const premiumPath = path.join(
  __dirname,
  "../../modules/commands/rx/premium.json"
);

const loadpremium = () => {
  if (!fs.existsSync(premiumPath)) {
    fs.writeFileSync(
      premiumPath,
      JSON.stringify({ users: {} }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync(premiumPath));
};

const savepremium = (data) => {
  fs.writeFileSync(premiumPath, JSON.stringify(data, null, 2));
};

  return async function ({ event }) {
    const dateNow = Date.now();
    const time = moment.tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY");
    const { allowInbox, PREFIX, ADMINBOT, NDH, DeveloperMode } = global.config;
    const { userBanned, threadBanned, threadInfo, threadData, commandBanned } = global.data;
    const { commands, cooldowns } = global.client;

    let { body, senderID, threadID, messageID, mentions, type, messageReply } = event;
    senderID = String(senderID);
    threadID = String(threadID);
    body = body || "x";

     // 🚫 SILENT IGNORE FOR BANNED USER / THREAD
  if (
    (userBanned.has(senderID) || threadBanned.has(threadID)) &&
    !ADMINBOT.includes(senderID)
  ) {
    return;
    }

    const threadSetting = threadData.get(threadID) || {};
    const threadPrefix = threadSetting.PREFIX || PREFIX;
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixRegex = new RegExp(`^(<@!?${senderID}>|${escapeRegex(threadPrefix)})\\s*`);

    let args = [];
    let commandName = "";
    const prefixUsed = body.startsWith(threadPrefix);

    const vipList = loadVIP();
    const vipMode = loadVIPMode();
    const isVIP = vipList.includes(senderID);

    // ===== LOAD PREMIUM USER =====
    const premiumData = loadpremium();
    const premiumUser = premiumData.users[senderID];

   // 🔥 AUTO EXPIRE CHECK
    if (premiumUser && premiumUser.expire <= Date.now()) {
    delete premiumData.users[senderID];
    savepremium(premiumData);
  }

    const ispremium =
   premiumUser && premiumUser.expire > Date.now();

    if ((ADMINBOT.includes(senderID) || isVIP) && !prefixUsed) {
      const temp = body.trim().split(/ +/);
      commandName = temp.shift()?.toLowerCase();
      args = temp;
    } else {
      if (!prefixRegex.test(body)) return;
      const [matchedPrefix] = body.match(prefixRegex);
      const argsTemp = body.slice(matchedPrefix.length).trim().split(/ +/);
      commandName = argsTemp.shift()?.toLowerCase();
      args = argsTemp;
    }

    if (!commandName) {
  if (!prefixUsed) return;

  const threadInfoo =
    threadInfo.get(threadID) || (await Threads.getInfo(threadID));

  const isThreadAdmin = threadInfoo.adminIDs.some(
    (el) => el.id == senderID
  );

  const isAdmin =
    ADMINBOT.includes(senderID) ||
    NDH.includes(senderID) ||
    isThreadAdmin;

  // 🧃 Admin / NDH / Group Admin
  if (isAdmin) {
    return api.sendMessage(
      global.getText("handleCommand", "adminPrefix"),
      threadID,
      messageID
    );
  }

  // 👤 Normal user
  return api.sendMessage(
    global.getText("handleCommand", "onlyprefix"),
    threadID,
    messageID
  );
    }
    
    for (const [cmdName, cmdObj] of commands) {
      if (cmdObj.config.aliases && cmdObj.config.aliases.includes(commandName)) {
        commandName = cmdName;
        break;
      }
    }

    let command = commands.get(commandName);
    if (!command && prefixUsed) {
      const allCommandName = Array.from(commands.keys());
      const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
      if (checker.bestMatch.rating >= 0.5) command = commands.get(checker.bestMatch.target);
      else return api.sendMessage(global.getText("handleCommand", "commandNotExist", checker.bestMatch.target), threadID, messageID);
    }

    // ===== PREMIUM CHECK (Permission-like) =====
if (command && command.config && command.config.premium === true) {
  if (!ADMINBOT.includes(senderID) && !ispremium) {
    return api.sendMessage(
      global.getText("handleCommand", "premiumOnly"),
      threadID,
      messageID
    );
  }
}
    
    if (!command && !prefixUsed) return;
    if (!command) {
      const allCommandName = Array.from(commands.keys());
      const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
      if (checker.bestMatch.rating >= 0.5) command = commands.get(checker.bestMatch.target);
      else return api.sendMessage(global.getText("handleCommand", "commandNotExist", checker.bestMatch.target), threadID, messageID);
    }

    if (!ADMINBOT.includes(senderID)) {
      if (vipMode && !vipList.includes(senderID)) {
        return api.sendMessage("> ❌\nOnly VIP users can use this command", threadID, messageID);
      }
    }

    let permssion = 0;
    const threadInfoo = threadInfo.get(threadID) || (await Threads.getInfo(threadID));
    const find = threadInfoo.adminIDs.find(el => el.id == senderID);

    if (NDH.includes(senderID)) permssion = 2;
    else if (ADMINBOT.includes(senderID)) permssion = 3;
    else if (find) permssion = 1;

    if (command.config.hasPermssion > permssion) {
      return api.sendMessage(global.getText("handleCommand", "permissionNotEnough", command.config.name), threadID, messageID);
    }

    // ===== Cooldown Check =====
if (!cooldowns.has(command.config.name)) {
  cooldowns.set(command.config.name, new Map());
}

const timestamps = cooldowns.get(command.config.name);
const expirationTime = (command.config.cooldowns || 1) * 1000;

if (
  timestamps.has(senderID) &&
  dateNow < timestamps.get(senderID) + expirationTime
) {
  return api.sendMessage(
    `⏱ Please wait ${Math.ceil(
      (timestamps.get(senderID) + expirationTime - dateNow) / 1000
    )} seconds before using ${command.config.name}`,
    threadID,
    messageID
  );
  }

    // ===== Run Command =====
    let getText2;
    if (command.languages && typeof command.languages == "object" && command.languages.hasOwnProperty(global.config.language)) {
      getText2 = (...values) => {
        let lang = command.languages[global.config.language][values[0]] || "";
        for (let i = values.length; i > 0; i--) {
          lang = lang.replace(new RegExp(`%${i}`, "g"), values[i]);
        }
        return lang;
      };
    } else getText2 = () => {};

    try {
      const Obj = {
        api,
        event,
        args,
        models,
        Users,
        Threads,
        Currencies,
        permssion,
        getText: getText2,
      };

      command.run(Obj);
      timestamps.set(senderID, dateNow);

      if (DeveloperMode === true)
        logger(
          global.getText(
            "handleCommand",
            "executeCommand",
            time,
            commandName,
            senderID,
            threadID,
            args.join(" "),
            Date.now() - dateNow
          ),
          "[ DEV MODE ]"
        );

      return;
    } catch (e) {
      return api.sendMessage(global.getText("handleCommand", "commandError", commandName, e), threadID, messageID);
    }
  };
};
