/**
 * ALL DIALOGUE, as data.
 *
 * A script is `{ start, nodes }`. A node is one of:
 *   { who, text, next }                     press to continue
 *   { who, text, choices: [{ t, go }] }     the recruit answers
 *   { who, text, input: true }              opens the name field
 *
 * `who: 'you'` swaps the portrait to the recruit. `next: null` ends the script.
 *
 * Markup inside `text`:
 *   *text*   emphasis (amber)
 *   ~text~   jargon the Division would like you to internalise (cyan)
 *   %N%      the agent's name
 *
 * TO EDIT THE WRITING: this file, and only this file. The engine
 * (ui/dialogue.js) knows nothing about content.
 *
 * @module data/dialogue
 */

export const SCRIPTS = {

  /* ================================================================== */
  /* the induction - plays at the start of every new career             */
  /* ================================================================== */
  induction: {
    start: 's0',
    nodes: {
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
        text: 'You will be miniaturised and paired with a Company ~white blood cell~. Do say hello. It is *very* keen, *very* fast, and it has precisely one instruction: go where it is pointed.',
        next: 'fire'
      },

      fire: {
        who: 'vax',
        text: 'You do not *select* anything. You *aim* and you *fire*. Point with the cursor, press the trigger, and it goes \u2014 in a straight line, at speed, through *everything*.',
        choices: [
          { t: 'Everything?', go: 'path' },
          { t: 'No target lock at all?', go: 'nolock' }
        ]
      },

      nolock: {
        who: 'vax',
        text: 'We removed it. Divers kept queueing up beautiful little targets and then standing somewhere idiotic. Now the overlay simply draws the *line* \u2014 what is on the line, dies. Much cleaner. Much faster. Much more your fault.',
        next: 'path'
      },

      path: {
        who: 'vax',
        text: 'Everything. It does not go around. Anything standing on that line is client property, and client property is *invoiced*. The overlay turns *red* when somebody on it is about to become an expense.',
        next: 'maze'
      },

      maze: {
        who: 'vax',
        text: 'Vessels are ~narrow~. You descend a branching network toward the contracted organ, one row at a time. Each junction is *sealed* until you clear the hostiles in it. Depth is the job.',
        next: 'o2'
      },

      o2: {
        who: 'vax',
        text: 'Now. The important part. Your ~oxygen tank~. It is the dive clock. When it empties, you do not fail the contract \u2014 you *die* in it, and the Division bills your estate for the recovery.',
        choices: [
          { t: 'How much gas do I get?', go: 'tank' },
          { t: 'And if I run low?', go: 'siphon' }
        ]
      },

      tank: {
        who: 'vax',
        text: 'A standard tank. Thrust burns it faster, and pressure burns it faster still, so a hypertensive district is *two* clocks against you. Requisitions sell larger tanks. Requisitions sell most things.',
        next: 'siphon'
      },

      siphon: {
        who: 'vax',
        text: 'If you run low, you use the ~siphon~. It is standard issue. It takes oxygen *out of the client* and puts it into you. It works perfectly.',
        choices: [
          { t: 'That sounds like theft.', go: 'theft' },
          { t: 'What does it cost me?', go: 'cost' }
        ]
      },

      theft: {
        who: 'vax',
        text: 'It is *harvesting*, and it is in clause nine, which they signed. It costs them integrity \u2014 real, measurable integrity \u2014 and it costs *you* reputation, scaled to how much the client is worth. Rob a warehouse associate, nobody notices. Rob a shareholder\u2026',
        next: 'corrupt'
      },

      cost: {
        who: 'vax',
        text: 'Their integrity, and your standing. The reputation hit scales with the client\u2019s *tier* \u2014 nobody audits a Tier D dive, and everybody audits a Tier S one. Breathe accordingly.',
        next: 'corrupt'
      },

      corrupt: {
        who: 'vax',
        text: 'Pathogens *corrupt* the client\u2019s own cells \u2014 a corrupted cell turns green, bleeds integrity every second it lives, and stops being property the moment it flips. Hesitation is the expensive option.',
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
        next: 'succession'
      },

      good: {
        who: 'vax',
        text: 'It is, and you will be invoiced for it at cost plus margin. Guessing stays free and pays a confidence premium, should you be feeling entrepreneurial.',
        next: 'succession'
      },

      succession: {
        who: 'vax',
        text: 'Last item. Your licence is an ~asset~, so it is *inheritable*. Should you not come back, the Division will find a relative, deduct probate, and put them straight to work. The family name carries. Some of the money carries. Your mistakes, mercifully, do not.',
        next: 'end'
      },

      end: {
        who: 'vax',
        text: 'That is the induction. Sign nothing, agree to everything, and watch your gas. Good luck, Agent %N%.',
        next: null
      }
    }
  }
};

/** The induction nodes - the only script the engine currently plays. */
export const SCRIPT = SCRIPTS.induction.nodes;

export function script(name) {
  return SCRIPTS[name] || SCRIPTS.induction;
}
