import { CouncilErrorCode, FollowUpAction, SeatId } from '@/lib/council/contract';

// Every visitor-facing string for The Council. Keys are stable: add new ones
// freely, but do not rename or remove existing keys (the scene imports them).
export const COUNCIL_COPY = {
  entry: {
    sticker: 'QUESTION EVERYTHING',
    peek: 'The council has opinions.',
    ariaLabel: 'Open The Council: six philosophical lenses that argue about your question',
  },

  /** The one-line promise. Good for the page description and share cards. */
  promise: 'Bring a thought. Meet some resistance. Leave with a better question.',

  scene: {
    heading: 'A few ways to see it.',
    intro: 'Six schools of thought I keep coming back to. Bring a question. They rarely agree.',
    placeholder: 'What are you trying to make sense of?',
    askCouncil: 'Ask the council',
    askSeat: (lensLabel: string) => `Ask the ${lensLabel}`,
    disclosure: 'AI interpretations of six traditions, not the real words of these thinkers. Fallible. Argue back.',
    startersLabel: 'Or start with one of these',
    backToBoard: 'back to the board',
    newQuestion: 'New question',
    stop: 'Stop',
    stopped: 'Stopped here.',
    exchangesLeft: (left: number) =>
      left <= 0 ? 'No exchanges left' : left === 1 ? '1 exchange left' : `${left} exchanges left`,
    privacyLink: 'What happens to what you type',

    // Shown next to the composer before a first live question is sent.
    sendNotice: 'Your question goes to an AI model provider to get a reply. Leave out anything private.',
    composerLabel: 'Your question',
    emptyQuestion: 'Give them something to chew on first.',
    tooLong: (max: number) => `Keep it under ${max} characters. The council prefers a sharp question.`,
    charsLeft: (left: number) => (left === 1 ? '1 character left' : `${left} characters left`),

    // Recipient: the whole council, or one selected seat.
    recipientLabel: 'Asking',
    wholeCouncil: 'the whole council',
    backToCouncil: 'Ask everyone instead',
    seatsLabel: 'The six seats',
    seatAria: (figure: string, lensLabel: string) => `${lensLabel}, with ${figure} as its face`,

    // Transcript furniture.
    transcriptLabel: 'The conversation',
    visitorLabel: 'You',
    synthesisLabel: 'Where they differ',
    routingLabel: 'Taking this one',
    followUpQuestionLabel: 'One question back',
    replyingTo: (lensLabel: string) => `Answering the ${lensLabel}`,
    objectingTo: (lensLabel: string) => `Objecting to the ${lensLabel}`,
    partial: 'Cut short.',
    scripted: 'Written in advance. No AI call.',
    startersWorkOffline: 'These work even when live replies are off.',
    resetPlacement: 'Tidy the stickers',
    soundOn: 'Sound: on',
    soundOff: 'Sound: off',
    whichSeat: 'Which seat?',
    councilNoteLabel: 'From the council',
    brandAria: 'rohan, back to the board',
    closeStance: (school: string) => `Close ${school}`,
  },

  actions: {
    push_back: {
      label: 'Push back',
      prompt: 'What doesn’t sit right?',
      hint: 'Tell one seat where it’s wrong. It has to answer you.',
    },
    say_more: {
      label: 'Say more',
      prompt: '',
      hint: 'One seat goes a level deeper, with an example.',
    },
    differ: {
      label: 'Where do we differ?',
      prompt: '',
      hint: 'A short, neutral read on what they really disagree about.',
    },
    debate: {
      label: 'Let them debate',
      prompt: '',
      hint: 'One seat objects to another’s claim. The other answers.',
    },
    hear_everyone: {
      label: 'Hear everyone',
      prompt: '',
      hint: 'The seats that stayed quiet give their take.',
    },
  } satisfies Record<FollowUpAction, { label: string; prompt: string; hint: string }>,

  // The small composer that opens for Push back.
  pushBack: {
    to: (lensLabel: string) => `Pushing back on the ${lensLabel}`,
    placeholder: 'Say it plainly. They can take it.',
    suggestionLabel: 'Or borrow this objection',
    submit: 'Send it',
    cancel: 'Never mind',
    empty: 'An objection needs words. What doesn’t sit right?',
    // Shown when a typed objection could not be sent and cannot be sent again from here.
    kept: 'Your objection is still here, so you can copy it. It can’t be sent from this thread now.',
  },

  // Choosing sides for Let them debate.
  debate: {
    pickObjector: 'Who objects?',
    pickAddressed: 'To whose claim?',
    summary: (objector: string, addressed: string) => `${objector} objects, ${addressed} answers`,
    start: 'Let them at it',
  },

  status: {
    routing: 'The council is deciding who should take this.',
    thinking: (figure: string) => `${figure} is thinking`,
    speaking: (figure: string) => `${figure} is replying`,
    waiting: (figure: string) => `${figure} is waiting for a turn`,
    synthesizing: 'Working out where they really differ',
    // The council replying as one voice, with no seat taking the question.
    council: 'The council is answering together',
  },

  // One friendly nudge while a follow-up remains, one when the thread is over.
  limits: {
    explain: 'Two exchanges per question: an opening and one follow-up. It keeps the replies sharp and the bill survivable.',
    oneLeft: 'One follow-up left. Choose it well.',
    threadEnded: 'That’s the round. Sit with it, or bring a new question.',
    threadEndedAction: 'Ask something new',
    visitorLeft: (left: number) =>
      left <= 0 ? 'No live questions left today' : left === 1 ? '1 live question left today' : `${left} live questions left today`,
    visitorDone: 'That’s your live questions for today. The starters are still open.',
  },

  // Stance intro: the small card on hover, focus or tap of a seat.
  stance: {
    faceLabel: 'The face',
    coreQuestionLabel: 'Always ends up asking',
    interpretation: (figure: string) => `An AI reading of the tradition. Not ${figure}’s own words.`,
    select: (lensLabel: string) => `Ask only the ${lensLabel}`,
    deselect: 'Back to the whole council',
    selected: 'Selected',
    readingToggle: 'Where to read more',
  },

  furtherReadingLabel: 'Further reading',
  furtherReadingNote: 'Free to read. Start here if this seat got under your skin.',
  opensInNewTab: 'opens in a new tab',

  // New question confirmation. Only shown when there is something to lose.
  confirmNew: {
    title: 'Start a new question?',
    body: 'This conversation isn’t saved anywhere, so it will be gone.',
    bodyDraft: 'You have an unsent draft. Starting over clears it.',
    confirm: 'Start fresh',
    cancel: 'Keep reading',
  },

  // Screen-reader announcements. Polite, and once per finished reply.
  announce: {
    seatSelected: (lensLabel: string) => `${lensLabel} selected. Your question goes to this seat only.`,
    councilSelected: 'Asking the whole council.',
    routed: (names: string) => `Replying: ${names}.`,
    replied: (lensLabel: string) => `${lensLabel} replied.`,
    synthesisReady: 'The summary of where they differ is ready.',
    followUpQuestion: 'The council has a question for you.',
    allReplied: 'All replies are in.',
    stopped: 'Stopped. Finished replies are kept.',
    threadEnded: 'This question has used both exchanges.',
    newQuestion: 'Cleared. Ready for a new question.',
  },

  errors: {
    invalid_request: 'That one didn’t go through. Try saying it another way.',
    thread_limit: 'That’s both exchanges for this question. Start a new one, or try a starter.',
    visitor_limit: 'You’ve used today’s live questions, and the council is taking a breather. The starters still work.',
    budget_exhausted: 'The council has talked itself out for today (the budget, not the opinions). The starters still work.',
    live_disabled: 'Live replies are off right now. The starter questions still work.',
    busy: 'One thing at a time. Let this reply finish first.',
    provider_error: 'The council lost its train of thought. Your question is still here.',
    timeout: 'That took too long. Your question is still here.',
  } satisfies Record<CouncilErrorCode, string>,
  retry: 'Try again',
  resetAt: (time: string) => `Back at ${time}.`,
  offline: 'You seem to be offline. Your question is still here.',

  // Shown whenever a visitor may need a person more than a philosophy.
  support: 'If this is urgent or you might be in danger, please reach a person now: a local emergency number or a crisis line.',

  // First-visit onboarding. Each sticker lands and introduces itself in a
  // small speech bubble (hello, then worldview), then the beats play. The
  // hello always names the school the figure represents. These are character
  // introductions written for this site, not quotations. About 135 words in
  // total, so it reads in a little over 20 seconds.
  intro: {
    beats: [
      { id: 'what', line: 'Six traditions, six famous faces, all AI interpretation. Bring a dilemma.' },
      { id: 'limit', line: 'Two exchanges per question. Spend them well.' },
      { id: 'invite', line: 'Your turn. What’s on your mind?' },
    ],
    seatLines: {
      stoic: {
        hello: 'Marcus Aurelius, emperor. I’m here for Stoicism.',
        worldview: 'I sort what’s mine to decide from what isn’t, then act decently.',
      },
      pragmatist: {
        hello: 'William James, doctor. I answer for Pragmatism.',
        worldview: 'I judge ideas by trying them and watching what happens.',
      },
      existentialist: {
        hello: 'Simone de Beauvoir. Existentialism, and nobody’s sidekick.',
        worldview: 'I think you’re freer than you admit, and never free alone.',
      },
      absurdist: {
        hello: 'Albert Camus, novelist. Absurdism is my corner.',
        worldview: 'I doubt life will ever explain itself, and I love it anyway.',
      },
      advaita: {
        hello: 'Adi Shankara, monk. I teach Advaita Vedanta.',
        worldview: 'Before your problem, I’d ask who you think is having it.',
      },
      marxist: {
        hello: 'Karl Marx, library regular. Marxism, obviously.',
        worldview: 'I ask who owns, who works and who profits, before judging anyone.',
      },
    } satisfies Record<SeatId, { hello: string; worldview: string }>,
    skip: 'Skip',
    begin: 'Ask something',
    replay: 'Meet the council again',
  },

  // /council/privacy
  privacy: {
    title: 'What happens to what you type',
    paragraphs: [
      'Short version: your words go to an AI provider to get a reply, and this site doesn’t keep them.',
      'When you ask a live question, what you typed is sent to a third-party AI model provider (through a service called OpenRouter) so it can write the replies. That is the only way the council can talk.',
      'This site does not store your conversation. It lives in your browser tab and nowhere else on my side. Close the tab or start a new question and it is gone.',
      'To stop one person from running up the bill, the site keeps a hashed network identifier, a hashed cookie id and a few usage counters. Those are counts, not content. They are cleared about 48 hours later, the next time anyone opens this page after that. The cookie itself lasts 30 days.',
      'What the model provider does with your text on its own systems is governed by its own policies, and I can’t make promises on its behalf. So don’t share anything you wouldn’t want a model provider to process: full names, health details, passwords, other people’s secrets.',
      'The replies are AI interpretations of philosophical traditions. The faces are historical. The words are not theirs, and they can be wrong, sometimes confidently.',
      'None of this is medical, legal or financial advice. If you are in real trouble, please talk to a person who can help: a professional, a local emergency number or a crisis line.',
    ],
    back: 'Back to the council',
  },
} as const;
