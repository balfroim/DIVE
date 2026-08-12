export async function findSuitableOfferIdx(page, suit = 99) {
  await page.evaluate((value) => { __D.Career.suit = value; }, suit);
  const idx = await page.evaluate(() => __D.Career.offers.findIndex(
    (offer) => __D.suitFor(offer.pressure) <= __D.Career.suit
  ));
  if (idx < 0) throw new Error('no suitable offer found');
  return idx;
}