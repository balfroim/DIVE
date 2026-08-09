/**
 * David Vax's induction.
 *
 * Markup inside the strings:
 *   *text*   emphasis (amber)
 *   ~text~   jargon the Division would like you to internalise (cyan)
 *   %N%      the agent's name
 *
 * Nodes: { who, text, next } or { who, text, choices:[{t, go}] } or { input:true }.
 * `who:'you'` swaps the portrait to the recruit.
 *
 * The induction plays at the start of every new career - it is where you are
 * named, so it cannot be skipped silently.
 *
 * @module ui/script
 */

export const SCRIPT = {
  s0: {
    who: 'vax',
    text: 'Welcome aboard, Agent Dave! David Vax \u2014 Division of Immunity and Virus Elimination. I am your broker, your mentor, and, per clause twelve, your *emergency contact*.',
    choices: [
      { t: 'My name is not Dave. My name is\u2026', go: 'name' },
      { t: 'Hello. I am Dave. Nice to meet you, sir.', go: 'dave' }
    ]
  },

  name: {
    who: 'vax',
    text: 'Oh. Oh dear. My apologies \u2014 *Dave was the last one*. Go on then, for the badge. Print clearly.',
    input: true
  },

  named: {
    who: 'vax',
    text: '%N%. Lovely. I shall have the badge re-etched \u2014 the current one still has Dave\u2019s teeth marks in it. He was, ah\u2026 *overcrowded*. By cancerous cells. Horribly. ANYWAY. The induction.',
    next: 'job'
  },

  dave: {
    who: 'vax',
    text: 'Wonderful. *Continuity*. The badge is printed, the payroll file is open, and Legal would very much prefer we did not reopen either. Welcome back, Dave.',
    next: 'job'
  },

  job: {
    who: 'vax',
    text: 'So. D.I.V.E. helps ~immunocompromised~ clients clear pathogens out of their bodies. *Profitably*.',
    choices: [
      { t: 'Immuno-what?', go: 'immuno' },
      { t: 'I read the brochure.', go: 'brochure' }
    ]
  },

  immuno: {
    who: 'vax',
    text: 'Immuno-com-pro-mised. Their immune system does not do its job. So we *rent* them one. Ours. By the hour.',
    next: 'freelance'
  },

  brochure: {
    who: 'vax',
    text: 'Nobody reads the brochure. It says their immune system does not work, so we rent them ours by the hour. There is a *graph*. The graph goes up.',
    next: 'freelance'
  },

  freelance: {
    who: 'vax',
    text: 'You are not staff, %N%. You are an *independent contractor* \u2014 which is marvellous news, because it means you keep your fees, and *also* your liabilities.',
    next: 'board'
  },

  board: {
    who: 'vax',
    text: 'Work comes off the ~contract board~. Your ~reputation~ decides what appears on it. Right now you have almost none, so you get the clients nobody insures.',
    choices: [
      { t: 'Meaning if they die, nothing happens?', go: 'expend' },
      { t: 'And when my reputation improves?', go: 'ladder' }
    ]
  },

  expend: {
    who: 'vax',
    text: 'Nothing *actionable*. Tier D clients waived recourse when they signed. Practise on them. Deliver, and the board will offer you people with *lawyers*.',
    next: 'ladder'
  },

  ladder: {
    who: 'vax',
    text: 'Deeper sites, higher blood pressure, better people. A Tier B client who dies is a *claim*. A claim is a lawyer. A lawyer is the end of your licence. Fail a contract and your reputation drops accordingly.',
    next: 'buddy'
  },

  buddy: {
    who: 'vax',
    text: 'You will be miniaturised and paired with a Company ~white blood cell~. Do say hello. It is *very* keen, *very* fast, and it cannot tell friend from foe. It eats whatever you *mark*.',
    next: 'path'
  },

  path: {
    who: 'vax',
    text: 'And it eats *everything on the way there*. It does not go around. Anything standing on that line is client property, and client property is *invoiced*. Give it a clean shot, %N%.',
    choices: [
      { t: 'So I have to aim it. With my body.', go: 'aim' },
      { t: 'Can it not simply go around?', go: 'around' }
    ]
  },

  aim: {
    who: 'vax',
    text: 'Precisely. Position yourself, mark from the right angle, and the line stays clean. The overlay will even draw it for you \u2014 red means somebody is about to become an expense.',
    next: 'maze'
  },

  around: {
    who: 'vax',
    text: 'It has one instruction and no imagination. It will not fire through a vessel wall, which is the only judgement it possesses. Everything else is *yours*.',
    next: 'maze'
  },

  maze: {
    who: 'vax',
    text: 'Vessels are ~narrow~. You descend a branching network toward the contracted organ, one row at a time. Each junction is *sealed* until you clear the pathogens in it. Depth is the job.',
    next: 'scan'
  },

  scan: {
    who: 'vax',
    text: 'You carry a ~scan pulse~. It identifies whatever it touches, it does not see through tissue, and it is a *consumable*. Every activation is billed to your contract.',
    choices: [
      { t: 'You are charging me to see?', go: 'charge' },
      { t: 'Understood. Clarity is a service.', go: 'good' }
    ]
  },

  charge: {
    who: 'vax',
    text: 'We are charging you for *certainty*. Guessing remains free, and pays a 50% confidence premium. Many divers guess. We hold a memorial each quarter; the catering is quite good.',
    next: 'corrupt'
  },

  good: {
    who: 'vax',
    text: 'It is, and you will be invoiced for it at cost plus margin. Guessing stays free and pays a confidence premium, should you be feeling entrepreneurial.',
    next: 'corrupt'
  },

  corrupt: {
    who: 'vax',
    text: 'One more thing. Pathogens *corrupt* the client\u2019s own cells \u2014 a corrupted cell turns green, bleeds integrity every second it lives, and stops being property the moment it flips. Hesitation is the expensive option.',
    next: 'end'
  },

  end: {
    who: 'vax',
    text: 'That is the induction. Sign nothing, agree to everything, and try to come back up. Good luck, Agent %N%.',
    next: null
  }
};
