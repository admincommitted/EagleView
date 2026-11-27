import { latestAviationNews } from './news.service.js';

export async function liveNews(req, res) {
  res.json(await latestAviationNews());
}
