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
  /* the onboarding - plays at the start of every new career             */
  /* ================================================================== */
  onboarding: {
    start: 's0',
    nodes: {
      s0: {
        who: 'vax',
        text: 'Welcome aboard, Agent Dave! I\'m David Vax, head HR of D.I.V.E., Department of Intravascular Virus Eradication.',
        choices: [
          { t: 'My name is not Dave. My name is\u2026', go: 'name' },
          { t: 'Hello. I am Dave. Nice to meet you, sir.', go: 'job' }
        ]
      },

      name: {
        who: 'vax',
        text: 'Oh, sorry, I confused you with the last contractor. His name was Dave. He was a good guy, but a little too ambitious: he died after being choked by cancer cells. May he rest in peace. Now, what is your name?',
        input: true
      },

      named: {
        who: 'vax',
        text: '%N%. Lovely. I shall have the badge re-etched.',
        next: 'job'
      },

      job: {
        who: 'vax',
        text: 'So. D.I.V.E. helps ~immunocompromised~ clients clear pathogens out of their bodies.',
        choices: [
          { t: 'Immuno-what?', go: 'immuno' },
          { t: 'I read the brochure.', go: 'freelance' }
        ]
      },

      immuno: {
        who: 'vax',
        text: 'Immuno-com-pro-mised. Basically, their immune system does not do its job. So we do the job for them, it\'s called an IAAS: Immunity As A Service.',
        next: 'freelance'
      },

      freelance: {
        who: 'vax',
        text: 'So, first, let\'s be clear. You are not staff, %N%. You are an *independent contractor* \u2014 which means you keep your fees, and *also* your liabilities.',
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
        text: 'There are no *legal consequences* per se, since Tier D clients pay less in exchange for less protection. Good old capitalism. That said, you\'ll still *lose reputation* if you fail. As for Tier S clients, you\'d better not lose them—trust me.',
        next: 'ladder'
      },

      ladder: {
        who: 'vax',
        text: 'You will have access to more difficult contract, more money but more consequence in case of failures !',
        next: 'buddy'
      },

      buddy: {
        who: 'vax',
        text: 'You will be miniaturised and paired with a buddy, a ~white blood cell~. Do say hello. It is *very* keen, *very* fast, and it has precisely one instruction: go where it is pointed and every moving cell in its path, it will kill.',
        next: 'target'
      },

      target: {
        who: 'vax',
        text: 'But watch out for friendly fire! The blood vessels are quite crowded. There are ~host cells~ and ~symbiotes~. If they’re killed, the host’s physical integrity decreases (*if it reaches zero, the host dies*), and you’ll get a *fine*.',
        next: 'o2'
      },

      o2: {
        who: 'vax',
        text: 'We are also providing you with a basic ~oxygen tank~. You can still buy better one later. No need to tell you that when it empties, you *die* in it, and the Department bills your estate for the recovery.',
        next: 'siphon'
      },



      siphon: {
        who: 'vax',
        text: 'However, if you run low, you can still use the ~siphon~. It takes oxygen *out of the client* and puts it into you in exchange for a reputation hit.',
        next: 'corrupt'
      },

      corrupt: {
        who: 'vax',
        text: 'Also note that pathogens can *corrupt* the client\u2019s own cells \u2014 a corrupted cell turns green, bleeds integrity every second it lives, so you need to kill it as soon as possible.',
        next: 'scan'
      },

      scan: {
        who: 'vax',
        text: 'You carry a ~scan pulse~. It identifies whatever it touches, it does not see through tissue, and it is a *consumable*. Every activation is billed to your contract.',
        next: 'succession'
      },

      succession: {
        who: 'vax',
        text: 'One last thing: if you happen to die on the job, one of your relatives can ~inherit~ your license. In addition to your credits (we don\'t take a cut, unlike the government), they\'ll inherit a portion of your reputation.',
        next: 'end'
      },

      end: {
        who: 'vax',
        text: 'Good luck, Agent %N%.',
        next: null
      }
    }
  }
};

/** The induction nodes - the only script the engine currently plays. */
export const SCRIPT = SCRIPTS.onboarding.nodes;

export function script(name) {
  return SCRIPTS[name] || SCRIPTS.onboarding;
}
