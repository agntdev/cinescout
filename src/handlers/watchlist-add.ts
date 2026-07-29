import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addWatchlist, claimOrCheckOwner } from "../movie/store.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("watchlist:add", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (await claimOrCheckOwner(ctx) !== "owner") {
    await ctx.reply("This private bot is available only to its owner.");
    return;
  }
  const current = ctx.session.currentMatch;
  if (!current) {
    await ctx.reply("Choose a title first, then you can add it to your watchlist.");
    return;
  }
  const result = await addWatchlist(ctx, current);
  if (result === "added") await ctx.reply(`Added ${current.title} to your watchlist.`);
  else if (result === "exists") await ctx.reply(`${current.title} is already in your watchlist.`);
  else await ctx.reply("Your watchlist storage isn't set up yet.");
});

export default composer;
