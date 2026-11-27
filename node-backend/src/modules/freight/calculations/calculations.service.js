import { Drawback } from '../../../models/index.js';

const findDrawbackRate = async (tariffItem) =>
  (await Drawback.findOne({ where: { schemeCode: tariffItem } })) || Drawback.findOne({ where: { tariffItem } });

/**
 * Same rule as the Scheme > Dbk screen: % of FOB limited by cap x qty, or the specific rate x qty when there is no %
 * rate. dbkRtSpe is the specific rate; the cap is dbkCap.
 */
function drawbackValue({ rate, specificRate, cap, fob, quantity }) {
  if (rate > 0) {
    const value = fob * (rate / 100);
    return cap > 0 && quantity > 0 ? Math.min(value, cap * quantity) : value;
  }
  if (specificRate > 0) return specificRate * quantity;
  return 0;
}

export async function calculateDrawback({ fob, qty, tariffItem }) {
  try {
    const drawback = await findDrawbackRate(tariffItem);
    if (!drawback) {
      return { success: false, message: 'Drawback not found', dbkRtAdv: 0, dbkRtSpe: 0, dbkVal: 0 };
    }
    const rate = parseFloat(drawback.drawbackRate) || 0;
    const specificRate = parseFloat(drawback.drawbackRateSpec) || 0;
    const cap = parseFloat(drawback.drawbackCap) || 0;
    const value = drawbackValue({
      rate,
      specificRate,
      cap,
      fob: parseFloat(fob) || 0,
      quantity: parseFloat(qty) || 0,
    });
    return {
      success: true,
      dbkRtAdv: rate,
      dbkRtSpe: specificRate,
      dbkCap: cap,
      uqc: drawback.uqc || '',
      dbkVal: value.toFixed(2),
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}
