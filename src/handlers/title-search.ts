import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, urlButton, type InlineButton } from "../toolkit/index.js";
import { viewingOptions, searchConfigured, searchTitles } from "../movie/api.js";
import { addQuery, claimOrCheckOwner, type SavedTitle } from "../movie/store.js";

const composer = new Composer<Ctx>();

function parsedQuery(text: string): { titleText: string; year?: string; season?: string; episode?: string } {
  const year = /\b((?:19|20)\d{2})\b/.exec(text)?.[1];
  const season = /\bS(\d{1,2})\b/i.exec(text)?.[1];
  const episode = /\bE(\d{1,3})\b/i.exec(text)?.[1];
  return { titleText: text.trim(), year, season, episode };
}

function candidateLabel(title: SavedTitle): string {
  return `${title.title}${title.year ? ` (${title.year})` : ""}`.slice(0, 60);
}

async function showOptions(ctx: Ctx, title: SavedTitle): Promise<void> {
  ctx.session.currentMatch = title;
  ctx.session.candidates = undefined;
  try {
    const options = await viewingOptions(title);
    const lines = [`${title.title}${title.year ? ` (${title.year})` : ""}`, options.providers.length ? `Available from: ${options.providers.join(", ")}.` : "No streaming provider is currently listed for your region."];
    if (!options.providers.length && options.publicDomain) lines.push("No public-domain viewing link was confirmed.");
    const rows: InlineButton[][] = [];
    if (options.availability) rows.push([urlButton("Where to watch", options.availability)]);
    if (options.trailer) rows.push([urlButton("Trailer", options.trailer)]);
    rows.push([inlineButton("Add to watchlist", "watchlist:add")], [inlineButton("Watchlist", "watchlist:view")]);
    await ctx.reply(lines.join("\n"), { reply_markup: inlineKeyboard(rows) });
  } catch {
    await ctx.reply(`I found ${title.title}, but viewing options aren't available right now. Try again shortly.`, {
      reply_markup: inlineKeyboard([[inlineButton("Add to watchlist", "watchlist:add")]]),
    });
  }
}

composer.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) return next();
  const access = await claimOrCheckOwner(ctx);
  if (access === "other") {
    await ctx.reply("This private bot is available only to its owner.");
    return;
  }
  if (access === "unavailable") return next();
  if (!searchConfigured()) {
    await ctx.reply("Movie search isn't set up yet. Add the metadata API key, then try again.");
    return;
  }
  const query = parsedQuery(text);
  await addQuery(ctx, query);
  try {
    const matches = await searchTitles(query.titleText);
    if (matches.length === 0) {
      await ctx.reply("I couldn't find that title. Check the spelling and try again.");
      return;
    }
    if (matches.length === 1) {
      await showOptions(ctx, matches[0]!);
      return;
    }
    ctx.session.candidates = matches;
    await ctx.reply("Choose the title you meant:", {
      reply_markup: inlineKeyboard(matches.map((match, index) => [inlineButton(candidateLabel(match), `title:pick:${index}`)])),
    });
  } catch {
    await ctx.reply("I couldn't search for titles right now. Try again shortly.");
  }
});

composer.on("callback_query:data", async (ctx, next) => {
  const match = /^title:pick:(\d+)$/.exec(ctx.callbackQuery.data);
  if (!match) return next();
  await ctx.answerCallbackQuery();
  if (await claimOrCheckOwner(ctx) !== "owner") {
    await ctx.reply("This private bot is available only to its owner.");
    return;
  }
  const title = ctx.session.candidates?.[Number(match[1])];
  if (!title) {
    await ctx.reply("That choice has expired. Search for the title again.");
    return;
  }
  await showOptions(ctx, title);
});

export default composer;
