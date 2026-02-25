"use strict";

const log = require("npmlog");
const utils = require("../utils"); // pull getType, etc. from your utils

module.exports = function (defaultFuncs, api, ctx) {
  return function getThemePictures(id, callback) {
    if (utils.getType(id) !== "String") id = "";

    const form = {
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "MWPThreadThemeProviderQuery",
      doc_id: "9734829906576883",
      server_timestamps: true,
      variables: JSON.stringify({ id }),
      av: ctx.userID,
    };

    // Promise mode if no callback provided
    if (!callback || utils.getType(callback) !== "Function") {
      return new Promise((resolve, reject) => {
        defaultFuncs
          .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
          .then((res) => res) // replace parseAndCheckLogin if needed
          .then((resData) => {
            if (resData.errors) return reject(resData);
            resolve(resData);
          })
          .catch((err) => {
            log.error("getThemePictures", err);
            reject(err);
          });
      });
    }

    // Callback mode
    try {
      defaultFuncs
        .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
        .then((res) => res) // replace parseAndCheckLogin if needed
        .then((resData) => {
          if (resData.errors) return callback(resData);
          callback(null, resData);
        })
        .catch((err) => {
          log.error("getThemePictures", err);
          callback(err);
        });
    } catch (err) {
      callback(err);
    }
  };
};
