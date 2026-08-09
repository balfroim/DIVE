/**
 * Client archetypes and the Division's tier system.
 *
 * You are a freelancer. The Division brokers the work, takes its cut, and sorts
 * human beings into five actuarial bands. A Tier D client is cheap because
 * nobody would sue on their behalf; a Tier S client is lucrative because
 * somebody very much would.
 *
 * To add a client: append to CLIENTS with a `tier` index into TIERS.
 *
 * @module data/clients
 */

export const TIERS = [
  { i: 0, name: 'D', label: 'Expendable', payMult: 0.85, lethal: false,
    note: 'No coverage. No dependants. No downside.' },
  { i: 1, name: 'C', label: 'Low-value', payMult: 1.10, lethal: false,
    note: 'Nominal cover. Losses are absorbed by the client.' },
  { i: 2, name: 'B', label: 'Insured', payMult: 1.45, lethal: true,
    note: 'Insured. A death here is a claim, and a claim is a lawyer.' },
  { i: 3, name: 'A', label: 'Premium', payMult: 1.90, lethal: true,
    note: 'Premium cover. Legal will attend the debrief in person.' },
  { i: 4, name: 'S', label: 'Shareholder', payMult: 2.60, lethal: true,
    note: 'Shareholder. Your licence is collateral for this one.' }
];

/**
 * `minRep` is the reputation at which the Division will let you near them.
 */
export const CLIENTS = [
  { job: 'Unpaid warehouse associate', tier: 0, minRep: 0,
    memo: 'Client waived all recourse in exchange for the shift. Enjoy the practice.' },
  { job: 'Gig courier, 61 hours logged', tier: 0, minRep: 0,
    memo: 'Contractor, not employee. Legally he is a small business having a bad day.' },
  { job: 'Night-shift data cleaner', tier: 0, minRep: 6,
    memo: 'Recruited from a queue. Insurers describe the file as "uncontested".' },
  { job: 'Sub-processor QA operative', tier: 1, minRep: 14,
    memo: 'Nominal cover. Bill conservatively; nobody is watching, but nobody is paying either.' },
  { job: 'Junior compliance clerk', tier: 1, minRep: 20,
    memo: 'Owns a modest policy. Do not test it.' },
  { job: 'Regional logistics supervisor', tier: 2, minRep: 30,
    memo: 'Insured to eleven months of salary. His widow would be a claimant, not a mourner.' },
  { job: 'Actuary, second class', tier: 2, minRep: 38,
    memo: 'He priced this policy himself. He will notice everything you bill.' },
  { job: 'Divisional counsel', tier: 3, minRep: 50,
    memo: 'Premium cover. Legal are watching this dive live, with snacks.' },
  { job: 'Board secretary', tier: 3, minRep: 62,
    memo: 'Keeper of the minutes. Losing her would be minuted.' },
  { job: 'Chief Yield Officer', tier: 4, minRep: 74,
    memo: 'Shareholder value in liquid form. Do not spill.' },
  { job: 'The Chairman', tier: 4, minRep: 86,
    memo: 'He has read your file. He was unmoved. Keep it that way.' }
];

/** Everyone the Division will introduce you to at this reputation. */
export function clientsForRep(rep) {
  const list = CLIENTS.filter((c) => c.minRep <= rep);
  return list.length ? list : [CLIENTS[0]];
}
