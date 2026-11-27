const AIR_CARGO_NEWS_FEED = 'https://www.aircargonews.net/feed/';
const MAX_NEWS_ITEMS = 5;
const ITEM_PATTERN = /<item>([\s\S]*?)<\/item>/g;
const CDATA_PATTERN = /<!\[CDATA\[([\s\S]*?)\]\]>/g;

/** Title, link and date of one <item>; null when it has no title or link. */
function newsItemOf(itemBlock) {
  const titleMatch = itemBlock.match(/<title>([\s\S]*?)<\/title>/);
  const linkMatch = itemBlock.match(/<link>([\s\S]*?)<\/link>/);
  if (!titleMatch || !linkMatch) return null;
  const dateMatch = itemBlock.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
  return {
    title: titleMatch[1].replace(CDATA_PATTERN, '$1').trim(),
    link: linkMatch[1].trim(),
    pubDate: dateMatch ? dateMatch[1].trim() : '',
  };
}

/** The latest air cargo headlines, read from the RSS feed with a plain regex (no XML library needed). */
export async function latestAviationNews() {
  const response = await fetch(AIR_CARGO_NEWS_FEED, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const xml = await response.text();
  const items = [];
  const itemPattern = new RegExp(ITEM_PATTERN.source, ITEM_PATTERN.flags);
  let match;
  while ((match = itemPattern.exec(xml)) !== null && items.length < MAX_NEWS_ITEMS) {
    const item = newsItemOf(match[1]);
    if (item) items.push(item);
  }
  return { success: true, data: items };
}
