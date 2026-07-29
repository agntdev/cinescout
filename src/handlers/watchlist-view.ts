import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { claimOrCheckOwner, removeWatchlist, watchlist } from "../movie/store.js";

registerMainMenuItem({ label: "Watchlist", data: "watchlist:view", order: 10 });
const composer = new Composer<Ctx>();

function titleLine(title: { title: string; year?: string; type: string }): string {
  return `${title.title}${title.year ? ` (${title.year})` : ""} · ${title.type === "tv" ? "Series" : "Film"}`;
}

composer.callbackQuery("watchlist:view", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (await claimOrCheckOwner(ctx) !== "owner") {
    await ctx.reply("This private bot is available only to its owner.");
    return;
  }
  const items = await watchlist(ctx);
  if (!items) {
    await ctx.reply("Your watchlist storage isn't set up yet.");
    return;
  }
  if (items.length === 0) {
    await ctx.reply("No titles saved yet — search for one, then tap Add to watchlist.");
    return;
  }
  const rows = items.slice(0, 8).map((item, index) => [inlineButton(`Remove ${index + 1}`, `watchlist:remove:${index}`)]);
  rows.push([inlineButton("Back to menu", "menu:main")]);
  await ctx.reply(`Your watchlist:\n${items.map((item, index) => `${index + 1}. ${titleLine(item)}`).join("\n")}`, {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.on("callback_query:data", async (ctx, next) => {
  const match = /^watchlist:remove:(\d+)$/.exec(ctx.callbackQuery.data);
  if (!match) return next();
  await ctx.answerCallbackQuery();
  if (await claimOrCheckOwner(ctx) !== "owner") {
    await ctx.reply("This private bot is available only to its owner.");
    return;
  }
  const removed = await removeWatchlist(ctx, Number(match[1]));
  await ctx.reply(removed ? `Removed ${removed.title} from your watchlist.` : "That title is no longer in your watchlist.");
});

export default composer;
