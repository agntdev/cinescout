import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { claimOrCheckOwner, recentQueries } from "../movie/store.js";

registerMainMenuItem({ label: "Recent searches", data: "history:view", order: 20 });
const composer = new Composer<Ctx>();

composer.callbackQuery("history:view", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (await claimOrCheckOwner(ctx) !== "owner") {
    await ctx.reply("This private bot is available only to its owner.");
    return;
  }
  const queries = await recentQueries(ctx);
  if (!queries) {
    await ctx.reply("Your query history storage isn't set up yet.");
    return;
  }
  if (queries.length === 0) {
    await ctx.reply("No searches yet — send a movie or series title to begin.");
    return;
  }
  const lines = queries.slice(0, 100).map((query, index) => `${index + 1}. ${query.titleText}${query.year ? ` (${query.year})` : ""}`);
  await ctx.reply(`Your recent searches:\n${lines.join("\n")}`, {
    reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
  });
});

export default composer;
