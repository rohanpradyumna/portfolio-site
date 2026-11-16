import { Seat, SeatId, SEAT_ACCENTS, SEAT_IDS } from '@/lib/council/contract';

// Each seat is a lens with a historical face, not an impersonation: replies
// are AI interpretations of a tradition and are never presented as the
// figure's own words.
//
// Further reading: every link was fetched and checked against the work it
// names. Primary texts where a free, stable edition exists, otherwise a
// peer-reviewed encyclopedia entry. (Camus and Beauvoir are still in
// copyright, so their seats point at the two encyclopedias instead of a text.)
export const SEATS: Record<SeatId, Seat> = {
  stoic: {
    id: 'stoic',
    school: 'Stoicism',
    lensLabel: 'Stoic lens',
    figure: 'Marcus Aurelius',
    figureDates: '121-180 CE',
    intro: 'Sort what’s yours to decide from what isn’t. Then do the decent thing with your half.',
    coreQuestion: 'Which part of this is up to you, and what would a good person do with it?',
    accent: SEAT_ACCENTS.stoic,
    furtherReading: [
      {
        title: 'Meditations',
        author: 'Marcus Aurelius',
        url: 'https://www.gutenberg.org/ebooks/2680',
        note: 'His private notebook, never meant for readers. Open it anywhere. Book 2 is a good first stop.',
      },
      {
        title: 'The Enchiridion',
        author: 'Epictetus (trans. T. W. Higginson)',
        url: 'https://www.gutenberg.org/ebooks/45109',
        note: 'A short handbook from the teacher Marcus kept quoting. Page one is the whole control idea in a paragraph.',
      },
      {
        title: 'Stoicism',
        author: 'Marion Durand, Simon Shogry and Dirk Baltzly · Stanford Encyclopedia of Philosophy',
        url: 'https://plato.stanford.edu/entries/stoicism/',
        note: 'The careful version. Section 4 covers the ethics, including what the Stoics really said about emotion.',
      },
    ],
  },
  pragmatist: {
    id: 'pragmatist',
    school: 'Pragmatism',
    lensLabel: 'Pragmatist lens',
    figure: 'William James',
    figureDates: '1842-1910',
    intro: 'Ideas are tools. Try them on real life and keep the ones that hold up.',
    coreQuestion: 'What changes in practice if you act on this, and how would you know you were wrong?',
    accent: SEAT_ACCENTS.pragmatist,
    furtherReading: [
      {
        title: 'Pragmatism: A New Name for Some Old Ways of Thinking',
        author: 'William James',
        url: 'https://www.gutenberg.org/ebooks/5116',
        note: 'Eight public lectures, written to be heard. Lecture 2 explains the method, Lecture 6 takes on truth.',
      },
      {
        title: 'The Will to Believe, and Other Essays in Popular Philosophy',
        author: 'William James',
        url: 'https://www.gutenberg.org/ebooks/26659',
        note: 'The title essay asks when you may commit before the evidence is in. Still argued about.',
      },
      {
        title: 'Pragmatism',
        author: 'Catherine Legg and Christopher Hookway · Stanford Encyclopedia of Philosophy',
        url: 'https://plato.stanford.edu/entries/pragmatism/',
        note: 'Where Peirce, James and Dewey agree, where they don’t, and the best objections to all three.',
      },
    ],
  },
  existentialist: {
    id: 'existentialist',
    school: 'Existentialism',
    lensLabel: 'Existentialist lens',
    figure: 'Simone de Beauvoir',
    figureDates: '1908-1986',
    intro: 'You’re free, which is the hard part. And nobody gets to be free alone.',
    coreQuestion: 'What are you choosing here, and whose freedom does that choice widen or shrink?',
    accent: SEAT_ACCENTS.existentialist,
    furtherReading: [
      {
        title: 'Simone de Beauvoir',
        author: 'Debra Bergoffen and Megan Burke · Stanford Encyclopedia of Philosophy',
        url: 'https://plato.stanford.edu/entries/beauvoir/',
        note: 'Traces her thinking in order and makes clear she was nobody’s disciple.',
      },
      {
        title: 'Simone de Beauvoir (1908-1986)',
        author: 'Shannon Mussett · Internet Encyclopedia of Philosophy',
        url: 'https://iep.utm.edu/beauvoir/',
        note: 'A shorter, friendlier overview. The ethics section is the place to start.',
      },
    ],
  },
  absurdist: {
    id: 'absurdist',
    school: 'Absurdism',
    lensLabel: 'Absurdist lens',
    figure: 'Albert Camus',
    figureDates: '1913-1960',
    intro: 'The universe isn’t going to explain itself. Live fully anyway, eyes open.',
    coreQuestion: 'How would you live this if no answer were ever coming?',
    accent: SEAT_ACCENTS.absurdist,
    furtherReading: [
      {
        title: 'Albert Camus',
        author: 'Ronald Aronson · Stanford Encyclopedia of Philosophy',
        url: 'https://plato.stanford.edu/entries/camus/',
        note: 'The clearest map of the absurd, revolt, and why he refused both despair and comfort.',
      },
      {
        title: 'Albert Camus (1913-1960)',
        author: 'David Simpson · Internet Encyclopedia of Philosophy',
        url: 'https://iep.utm.edu/albert-camus/',
        note: 'Good on the novels and on why he kept saying he was not an existentialist.',
      },
    ],
  },
  advaita: {
    id: 'advaita',
    school: 'Advaita Vedanta',
    lensLabel: 'Advaita lens',
    figure: 'Adi Shankara',
    figureDates: 'c. 8th century CE',
    intro: 'Before fixing the problem, look at who has it. The knot is often in the “me”.',
    coreQuestion: 'Who do you take yourself to be in this, and is that what you are?',
    accent: SEAT_ACCENTS.advaita,
    furtherReading: [
      {
        title: 'Śaṅkara',
        author: 'Neil Dalal · Stanford Encyclopedia of Philosophy',
        url: 'https://plato.stanford.edu/entries/shankara/',
        note: 'Start here. Plain explanations of superimposition, ignorance and the two levels of truth.',
      },
      {
        title: 'Advaita Vedanta',
        author: 'Sangeetha Menon · Internet Encyclopedia of Philosophy',
        url: 'https://iep.utm.edu/advaita-vedanta/',
        note: 'A compact overview of the school, including the thinkers who came after Shankara and disagreed.',
      },
      {
        title: 'The Vedanta-Sutras with the Commentary by Sankaracarya',
        author: 'Adi Shankara (trans. George Thibaut)',
        url: 'https://www.gutenberg.org/ebooks/16295',
        note: 'The primary text, and dense. Shankara’s own short introduction on superimposition is the part to read.',
      },
    ],
  },
  marxist: {
    id: 'marxist',
    school: 'Marxism',
    lensLabel: 'Marxist lens',
    figure: 'Karl Marx',
    figureDates: '1818-1883',
    intro: 'Before judging the person, check the setup: who owns, who works, who benefits.',
    coreQuestion: 'Who does the work here, who owns the result, and who gains from how it’s framed?',
    accent: SEAT_ACCENTS.marxist,
    furtherReading: [
      {
        title: 'Estranged Labour (Economic and Philosophic Manuscripts of 1844)',
        author: 'Karl Marx',
        url: 'https://www.marxists.org/archive/marx/works/1844/manuscripts/labour.htm',
        note: 'Young Marx on why work can stop feeling like yours. Short, and closer to everyday life than Capital.',
      },
      {
        title: 'Manifesto of the Communist Party',
        author: 'Karl Marx and Friedrich Engels',
        url: 'https://www.marxists.org/archive/marx/works/1848/communist-manifesto/',
        note: 'The famous pamphlet. Chapter I is the argument about class and history in about twenty minutes.',
      },
      {
        title: 'Karl Marx',
        author: 'Jonathan Wolff and David Leopold · Stanford Encyclopedia of Philosophy',
        url: 'https://plato.stanford.edu/entries/marx/',
        note: 'Sober and critical. Good on what he argued, what he didn’t, and where scholars still disagree.',
      },
    ],
  },
};

export const SEAT_LIST: Seat[] = SEAT_IDS.map((id) => SEATS[id]);
