import { Starter } from '@/lib/council/contract';

// Curated conversations. Openings and scripted follow-ups are served straight
// from here (no model call), so they work with live AI off. They are also the
// quality bar the live prompt is tuned toward: one claim per turn, a reason
// applied to the situation, and objections aimed at a specific sentence.
//
// Each seat opens two of the four questions. Trios are picked because those
// three lenses give different answers, not because they cover the most ground.
export const STARTERS: Starter[] = [
  {
    id: 'admire-without-respect',
    question: 'Can I admire someone’s work without respecting them?',
    opening: {
      routing: {
        seatIds: ['stoic', 'pragmatist', 'marxist'],
        reason: 'Three places to put the weight: your own judgment, what the admiration does, and who really made the work.',
      },
      turns: [
        {
          role: 'seat',
          seatId: 'stoic',
          text: 'Yes, if you are exact about what you are admiring. Skill and character are different things, and praising one does not sign you up for the other. A well-built bridge is well built whoever built it. The part that is yours to watch is your own judgment, because admiration quietly turns into imitation. So admire the craft, and choose your models for how to live separately, on stricter grounds. The work can teach you technique. Only a good person can show you how to be one.',
        },
        {
          role: 'seat',
          seatId: 'pragmatist',
          text: '“Admire” is doing three jobs here, so split it up. Learning from the work costs nobody anything. Paying for it sends money and attention somewhere. Defending the maker in public lends them your credibility. Those are different acts with different consequences, and you can say yes to one and no to another. So the test is not how you feel about the person. It is what your admiration does once it leaves your head. Where does yours actually go?',
        },
        {
          role: 'seat',
          seatId: 'marxist',
          text: 'I would question the “someone” first. Almost nothing admirable is made by one person. There are editors, engineers, assistants, crews and whoever kept the household running, and then one name on the cover. The story of the lone genius is useful to whoever owns the result, because credit and money follow the name. So you may be admiring the labor of many people and disrespecting one of them. That is a far easier position to hold than the one you started with.',
        },
      ],
      followUpQuestion: 'When you say admire, do you mean learn from, pay for, or look up to?',
    },
    followUps: {
      hear_everyone: {
        seatIds: ['existentialist', 'absurdist', 'advaita'],
        turns: [
          {
            role: 'seat',
            seatId: 'existentialist',
            text: 'You can, but look at why the question is tempting. Keeping the work and the person in separate boxes is tidy, and sometimes it is a way of not asking who paid for the work. If the maker treated people as material, as things to be used up on the way to a masterpiece, then that is part of what the work is. Admire it if you still can with that in view. What I would not trust is an admiration that only survives by not looking.',
          },
          {
            role: 'seat',
            seatId: 'absurdist',
            text: 'The work is here. You can read it, hear it, stand in front of it. The person is mostly a story you were told. So start with what is actually in the room. If the thing moves you, it moves you, and no biography revokes that after the fact. What I refuse is the next step, where the art becomes an alibi and talent starts excusing what a person did to other people. Nothing excuses that. Love the song. Do not let it testify for anyone.',
          },
          {
            role: 'seat',
            seatId: 'advaita',
            text: 'Notice what happens inside the admiring. For a moment you forget yourself, and something in the work feels like yours. Then you learn about the maker and feel implicated, as if their conduct were now on your account. That is identification, and it is the knot. You were never one with the person. You were responding to clarity or beauty, which does not belong to whoever happened to carry it. At the everyday level, of course, what they did to others stands, and it matters.',
          },
        ],
      },
      push_back: {
        seatIds: ['pragmatist'],
        visitorText: 'I think achievements and personal conduct should always be judged separately.',
        turns: [
          {
            role: 'seat',
            seatId: 'pragmatist',
            text: 'As a default, I like it. It stops us rewriting someone’s talent the moment we dislike them, and that protects honest judgment. My trouble is with “always”. Try the rule on two cases. In one, the conduct has nothing to do with the work, and separating them costs nothing. In the other, the conduct is how the work got made, or your money and praise are what let it continue. There the rule asks you to ignore a link you can plainly see, and a rule that needs you not to look is not doing its job. So keep it as a presumption, and say what would override it: harm done through the work, harm funded by the work, or neither?',
          },
        ],
      },
      say_more: {
        seatIds: ['stoic'],
        turns: [
          {
            role: 'seat',
            seatId: 'stoic',
            text: 'Here is the distinction I would lean on. Admiring is a judgment that something is excellent. Respecting, in the sense you mean, is closer to trusting a character. The first can be earned in one brilliant afternoon. The second takes a life. Holding both judgments at once is not the danger. The danger is the slide between them: excusing the person because the work is good, or dismissing the work because the person is not. Either way you have stopped seeing accurately, and seeing accurately is your whole job here. A practical check: can you describe what you admire without using the maker’s name? If you can, it is the craft you admire. If you cannot, it may be something else.',
          },
        ],
      },
      debate: {
        seatIds: ['marxist', 'stoic'],
        turns: [
          {
            role: 'seat',
            seatId: 'marxist',
            replyToSeatId: 'stoic',
            text: 'You said a well-built bridge is well built whoever built it. “Whoever built it” is the part that keeps disappearing. Your split between skill and character treats the work as a finished object with one maker behind it. But how the people on the job were treated is not a private matter of someone’s character. It is part of how the thing got made. You cannot set that aside and still claim to be judging the work accurately.',
          },
          {
            role: 'seat',
            seatId: 'stoic',
            replyToSeatId: 'marxist',
            text: 'I accept the correction about the bridge. Who built it matters to the credit, and if people were mistreated in the building, that belongs in any honest account of the work. But two questions are still separate: whether this is good work, and whether I should model my life on anyone involved in it. My claim was about the second. You have changed who deserves the credit. You have not shown that admiring a skill commits me to anything about a character.',
          },
        ],
      },
      differ: {
        turns: [
          {
            role: 'synthesis',
            text: 'Nobody here said you must respect the maker, so that is not the disagreement. It is about where the question lives. The Stoic lens puts it in your judgment: keep skill and character apart, and watch what you imitate. The Pragmatist lens puts it in consequences: learning, paying and defending are different acts. The Marxist lens doubts there is a single maker at all. They would part ways over something concrete, like buying the next release. One asks what it does to you, one asks what it funds, and one asks who made it and who gets paid. Which of those would change what you do?',
          },
        ],
      },
    },
  },

  {
    id: 'acceptance-or-avoidance',
    question: 'When does acceptance become avoidance?',
    opening: {
      routing: {
        seatIds: ['stoic', 'absurdist', 'advaita'],
        reason: 'One lens recommends acceptance, one distrusts it, and one says you cannot do it on purpose.',
      },
      turns: [
        {
          role: 'seat',
          seatId: 'stoic',
          text: 'When you file something under “not up to me” that actually is. Acceptance is for outcomes, other people and the past. It was never meant for your own conduct. So run the sort honestly. The diagnosis is not yours to choose, but the appointment is. Their reaction is not yours, but the conversation is. If accepting a situation leaves you with nothing at all to do, be suspicious. There is almost always a part with your name on it, and it is usually the hard part.',
        },
        {
          role: 'seat',
          seatId: 'absurdist',
          text: 'I would be wary of acceptance from the start. Too often it means making peace, and making peace means you stopped looking. There is another way to live with what cannot be fixed: see it exactly as it is, refuse to call it fine, and keep going anyway. That is not avoidance, because you are still facing the thing. The test is appetite. If your acceptance left you more awake to your days, keep it. If it left you numb and a little relieved, something in you resigned.',
        },
        {
          role: 'seat',
          seatId: 'advaita',
          text: 'Real acceptance is not a decision. It is what is left when resistance drops, and it can look straight at the thing. Avoidance has a tell: there is something you would rather not see, and “I have accepted it” is the lid on top. So check for aversion. Can you think about the situation in detail without flinching or reaching for a calm thought? Calm that needs protecting is not acceptance. And when acceptance is real, it does not excuse you from acting. It only takes the panic out of the action.',
        },
      ],
      followUpQuestion: 'What are you deciding whether to accept: an outcome, a person, or something about yourself?',
    },
    followUps: {
      hear_everyone: {
        seatIds: ['pragmatist', 'existentialist', 'marxist'],
        turns: [
          {
            role: 'seat',
            seatId: 'pragmatist',
            text: 'Judge it by what it does. Acceptance tends to free up energy: you stop fighting the unchangeable and something else in your life starts moving. Avoidance tends to leak: the same problem keeps coming back at 3 a.m. in new clothes, costing a little more each time. So watch for a month. Is the thing you accepted getting quieter, or only getting postponed? And was it truly unchangeable, or did you never run the test? Most people declare a thing fixed before trying a single small experiment.',
          },
          {
            role: 'seat',
            seatId: 'existentialist',
            text: 'It becomes avoidance when you turn a situation into a fate. Some things about your life are simply given: your past, your body, what others have already done. But what you do next is not given, and “this is just how it is” is one of the oldest ways to hide that from yourself. I would also ask who else lives inside your acceptance. If accepting it means someone keeps being treated badly, you included, then you have not accepted a fact. You have made a choice and declined to sign it.',
          },
          {
            role: 'seat',
            seatId: 'marxist',
            text: 'Ask who benefits from your acceptance. A great deal of advice about acceptance is aimed at people whose conditions could be changed, only not by one person alone. Overwork, low pay and an impossible rent get reframed as things to make peace with, and that framing is very convenient for whoever is on the other side of them. So before you accept, ask whether the thing is unchangeable or only unchangeable by you alone. Those are different facts. The second usually means the next step involves other people.',
          },
        ],
      },
      push_back: {
        seatIds: ['absurdist'],
        visitorText: 'Refusing to make peace sounds exhausting. Isn’t that just staying angry at things I can’t change?',
        turns: [
          {
            role: 'seat',
            seatId: 'absurdist',
            text: 'Fair, and if it meant staying angry I would drop it too. Anger wants the thing to change, and it burns you down when the thing does not. What I mean is quieter. You stop asking the situation to become acceptable, and you stop pretending it already is. That takes less energy than fighting or making peace, because you are no longer maintaining a story. Think of someone caring for a parent who will not get better. They do not approve of it, and they are not at war with it. They show up, they notice the afternoon light in the room, they are fully there. That is the refusal I mean. It is closer to attention than to rage.',
          },
        ],
      },
      say_more: {
        seatIds: ['advaita'],
        turns: [
          {
            role: 'seat',
            seatId: 'advaita',
            text: 'Take a concrete case. Someone did not get the role they worked years for, and says they have accepted it. In one version they can talk about it plainly, feel the sting, and tell you what they will do next. In another they change the subject, say it never mattered much, and feel a flash of heat when a colleague’s name comes up. The second person is managing a feeling, not accepting a fact. What is being protected is an image of themselves: the one who should have been chosen. The loss is real at the everyday level, and so is the next application. But most of the weight sits in the identification, and that can be looked at directly. Once it is seen, acceptance is not something you have to perform.',
          },
        ],
      },
      debate: {
        seatIds: ['absurdist', 'stoic'],
        turns: [
          {
            role: 'seat',
            seatId: 'absurdist',
            replyToSeatId: 'stoic',
            text: 'You said acceptance is for outcomes, other people and the past. You make the sort sound clean, and once a thing lands in the “not mine” pile, you make your peace with it. I will not. A child’s illness is not up to me, and I still refuse to call it acceptable. That refusal changes nothing, I know. But your tidy pile is where people learn to stop feeling what they ought to keep feeling.',
          },
          {
            role: 'seat',
            seatId: 'stoic',
            replyToSeatId: 'absurdist',
            text: 'I never asked you to call it acceptable, or to stop feeling. I asked you not to spend yourself demanding that it be otherwise, because that demand has nowhere to land, and the child still needs someone steady in the room. We agree about showing up. We differ about the protest. You keep it as proof that you are honest. I think protest aimed at what cannot answer is strength taken from the person in front of you.',
          },
        ],
      },
      differ: {
        turns: [
          {
            role: 'synthesis',
            text: 'All three agree on one thing: acceptance that lets you stop looking is avoidance. They split on what acceptance is for. The Stoic lens treats it as a sorting tool: accept outcomes, never your own inaction. The Absurdist lens does not want you reconciled at all, only clear-eyed and still engaged. The Advaita lens says acceptance cannot be done on purpose, and shows up when you stop defending a picture of yourself. So there are three tests. What is left for me to do? Am I more awake or more numb? What can I not look at? They can give different answers about the same situation.',
          },
        ],
      },
    },
  },

  {
    id: 'want-more-and-content',
    question: 'Can I want more and still be content?',
    opening: {
      routing: {
        seatIds: ['advaita', 'existentialist', 'marxist'],
        reason: 'One says you are already whole, one says you are made of reaching, and one asks who taught you to want.',
      },
      turns: [
        {
          role: 'seat',
          seatId: 'advaita',
          text: 'Yes, and the order matters. If contentment is waiting on the far side of the next thing, you will chase it forever, because the one who feels incomplete comes along to every finish line. Wanting from lack says “I will be enough when”. Wanting from fullness says “I am fine, and this would be good to do”. The actions can look identical. Only the second kind can lose without being diminished. So keep the ambition, and question the belief that you are a smaller person without its results.',
        },
        {
          role: 'seat',
          seatId: 'existentialist',
          text: 'I do not think you were built for contentment, if that means arriving and staying put. A person is a reaching toward what is not here yet, and when the reaching stops, a life goes flat however comfortable it is. So yes, want more. But contentment as a finished state is something we promise ourselves so that we can stop choosing. The version I trust is being at home in the reaching itself. And “more” deserves a hard look: more for whom, and at whose expense?',
        },
        {
          role: 'seat',
          seatId: 'marxist',
          text: 'First ask where the wanting comes from. A great many industries need you to feel slightly behind, because a contented person is a poor customer and a harder employee to squeeze. So some of your “more” was installed. But not all of it. More time, more pay, more say over your own work: those are not greed, and being told to feel grateful instead is an old trick. Sort your wants. Which would survive if nobody were watching, and which only make sense as a ranking?',
        },
      ],
      followUpQuestion: 'More of what, exactly? Name the first thing that comes to mind.',
    },
    followUps: {
      hear_everyone: {
        seatIds: ['stoic', 'pragmatist', 'absurdist'],
        turns: [
          {
            role: 'seat',
            seatId: 'stoic',
            text: 'You can, if you want it with a condition attached. Aim at the promotion, the bigger project, the better house, and add silently: if nothing prevents it. Those things are worth preferring. They are not worth your peace, because they are not fully yours to secure. What is yours is the quality of the effort and the kind of person you are while making it. Contentment that rests there cannot be taken by a bad quarter. Then wanting more is a direction you walk in, not a debt the world owes you.',
          },
          {
            role: 'seat',
            seatId: 'pragmatist',
            text: 'Stop treating them as opposites and check how they behave together in your actual weeks. Some wanting makes the present better: it gives the day a shape and you enjoy the work. Some wanting makes the present worse: nothing counts until the next milestone, and then that one does not count either. Same word, different results. So run a small audit. After your last three wins, how long did the satisfaction last? If the answer is “about a day”, the wanting is not the problem. The scoring system is.',
          },
          {
            role: 'seat',
            seatId: 'absurdist',
            text: 'I would want more, yes. More mornings, more swimming, more of the people I love, more work that uses me up. That kind of wanting is already contentment, because it is aimed at what is here. The trouble starts when “more” means later: the life that begins after the raise, the move, the recognition. That is a bet against the only days you are sure to have. Be greedy for the present. Be suspicious of any wanting that asks you to wait.',
          },
        ],
      },
      push_back: {
        seatIds: ['advaita'],
        visitorText: 'If I already felt whole, I don’t think I’d get out of bed. Isn’t dissatisfaction the fuel?',
        turns: [
          {
            role: 'seat',
            seatId: 'advaita',
            text: 'It is one fuel, and it does work. People build remarkable things out of feeling not enough. But look at what it costs to run on. It only burns while you feel behind, so every success has to be discounted quickly or the engine stalls. That is why a win lasts about a day. There is another source, and you already know it: absorption in doing something well, curiosity, care for the people the work serves. A musician practises for hours without needing to feel worthless first. I am not asking you to give up drive. I am asking which fuel you are running on. And I should be honest about this lens: it is better at loosening the grip than at telling you what to aim for.',
          },
        ],
      },
      say_more: {
        seatIds: ['marxist'],
        turns: [
          {
            role: 'seat',
            seatId: 'marxist',
            text: 'Here is a way to do the sorting. Take one thing you want more of, say a bigger title. Ask what it would change in your days: more control over your time, more interesting problems, more security? Those are real needs, and wanting them is reasonable. Now ask what part is only position: being ahead of the people you started with. That part has no finish line, because a ranking always has someone above you. It is also the part an employer can pay you in, since a title is cheaper than money or time. So you can be content and still want more, if the “more” is something you can actually use. Wanting to outrank is the one kind of wanting built never to be satisfied.',
          },
        ],
      },
      debate: {
        seatIds: ['existentialist', 'advaita'],
        turns: [
          {
            role: 'seat',
            seatId: 'existentialist',
            replyToSeatId: 'advaita',
            text: 'You said the one who feels incomplete comes along to every finish line, and that underneath it I am fine. I do not think the incompleteness is a mistake to see through. It is what a person is: unfinished, open, still deciding. A wholeness that no failure can touch sounds like stepping out of your own life to watch it. If nothing can diminish you, in what sense were you ever at risk in what you chose?',
          },
          {
            role: 'seat',
            seatId: 'advaita',
            replyToSeatId: 'existentialist',
            text: 'The risk is real, and so is the loss. A failed venture costs money, years, sometimes friendships, and that deserves grief. What I question is one extra step: the conclusion that you are now less. You call the openness what a person is. I agree it is what a life looks like. I am pointing at the one who knows the life, present before the venture and after it. That is not watching from outside. It is why you can risk everything and not be destroyed.',
          },
        ],
      },
      differ: {
        turns: [
          {
            role: 'synthesis',
            text: 'They agree you should not wait for contentment to arrive with the next achievement. They disagree about what you are. The Advaita lens says you are already complete, so wanting is optional and losing takes nothing essential. The Existentialist lens says you are unfinished by nature, so wanting is the point and settled contentment is a kind of sleep. The Marxist lens steps outside both and asks who profits from your dissatisfaction, and which wants are really yours. That leaves a choice about your own restlessness: treat it as a misunderstanding to see through, as your freedom at work, or as partly manufactured. Each implies a different thing to do with it.',
          },
        ],
      },
    },
  },

  {
    id: 'meaning-is-made',
    question: 'If meaning is made, why commit to anything?',
    opening: {
      routing: {
        seatIds: ['existentialist', 'absurdist', 'pragmatist'],
        reason: 'All three accept the premise. They disagree about what follows from it.',
      },
      turns: [
        {
          role: 'seat',
          seatId: 'existentialist',
          text: 'Because made is not the same as fake. A promise is made too, and nobody thinks that lets you off it. If nothing outside you guarantees what matters, then commitment is not decoration. It is the only way anything comes to matter at all. And you do not do it alone: a commitment becomes real when other people can rely on it, answer it, build on it. Keeping every option open feels like freedom. Mostly it is a way of never being answerable for anything.',
        },
        {
          role: 'seat',
          seatId: 'absurdist',
          text: 'I would drop the “why”. You are asking for a reason strong enough to justify the commitment in advance, and there is not one. There never was, even for people who believed there was. So do not commit in order to make life mean something. Commit the way you love someone: with no guarantee, and without needing the universe to countersign. The work, the person, the place are worth your full attention today. That is not a foundation. It is enough to live on, and it does not require lying to yourself.',
        },
        {
          role: 'seat',
          seatId: 'pragmatist',
          text: 'Because some things only show their worth to people who commit first. You cannot find out whether a marriage, a craft or a company was worth it by standing outside and assessing. The evidence only shows up once you are in. So treat commitment as how you run the test, not as the prize for finishing it. And “made” does not mean arbitrary. A bridge is made, and it either holds or it does not. Made meanings get tested the same way, by living on them and seeing what gives.',
        },
      ],
      followUpQuestion: 'Is there a specific commitment you are hesitating over, or is this about commitment in general?',
    },
    followUps: {
      hear_everyone: {
        seatIds: ['stoic', 'advaita', 'marxist'],
        turns: [
          {
            role: 'seat',
            seatId: 'stoic',
            text: 'I would question the premise a little. Not all of it is made. You did not invent the fact that people depend on you, or that you are someone’s child, friend, colleague, fellow citizen. Those roles come with work attached whether or not the universe has a purpose. So you do not need to solve meaning before you commit. Start from what your position already asks of you, and do that well. The question “why commit?” tends to get quieter once you are doing something that is plainly yours to do.',
          },
          {
            role: 'seat',
            seatId: 'advaita',
            text: 'Look at what the question is afraid of. It assumes there is a you who must pick the right commitment or be wasted, and that without a guaranteed meaning, that you is at risk. The anxious chooser is worth examining before the choice is. On this view your worth does not come from what you commit to, so you are free to commit without betting your identity on it. Do the work that falls to you, fully, and leave the result out of your definition of yourself. Commitment gets lighter that way, and steadier.',
          },
          {
            role: 'seat',
            seatId: 'marxist',
            text: 'Meaning is made, but not by you alone and not from scratch. People make it together, out of the work and relationships they actually have. Notice, too, that the feeling that nothing is worth committing to is common among people whose work is not really theirs: they do not choose its purpose or see its result. That is less a philosophical problem than a description of the job. So ask a different question. Where in your life do you make something with other people and see the point of it? Commitment usually comes easily there.',
          },
        ],
      },
      push_back: {
        seatIds: ['pragmatist'],
        visitorText: 'But if I can only tell from the inside, I could waste ten years on the wrong thing.',
        turns: [
          {
            role: 'seat',
            seatId: 'pragmatist',
            text: 'You could, and I will not pretend otherwise. But compare it with the alternative you are actually choosing, which is ten years of not committing. That is not a neutral waiting room. It has results of its own, and you already know some of them. Two things lower the risk. First, a commitment does not have to be for life on day one. Give it a real season, long enough to get past the boring middle, and decide now what you would need to see by the end. Second, a commitment that fails is rarely nothing. You leave with skills, people and a sharper idea of what you want. What would a one-year version of this look like?',
          },
        ],
      },
      say_more: {
        seatIds: ['existentialist'],
        turns: [
          {
            role: 'seat',
            seatId: 'existentialist',
            text: 'Take the promise again, because it shows the structure. When you promise a friend you will be there, nothing in nature forces you to keep it. Its whole weight comes from you continuing to choose it, and from her arranging part of her life around it. That is what a made meaning is: fragile, because you could walk away, and real, because someone is standing on it. So the question is not whether a commitment is justified from outside. Nothing is. The question is whether you are willing to be the one who holds it up, and to choose it again on the days it stops being exciting. People who wait for a commitment that will carry itself are waiting for a meaning that does not need them. There isn’t one.',
          },
        ],
      },
      debate: {
        seatIds: ['absurdist', 'existentialist'],
        turns: [
          {
            role: 'seat',
            seatId: 'absurdist',
            replyToSeatId: 'existentialist',
            text: 'You said commitment is the only way anything comes to matter. I think that puts the meaning back in the future, where it has to be earned. The sea mattered this morning and I committed to nothing. I also worry about where your version leads. People who need a commitment to justify their lives have done terrible things to keep it justified. I would sooner love the work and admit it proves nothing.',
          },
          {
            role: 'seat',
            seatId: 'existentialist',
            replyToSeatId: 'absurdist',
            text: 'The swim is yours, and I would not take it from you. But you did not get to the sea alone, and you will not keep it alone. Someone taught you to swim, and someone has to keep that coast open. A morning needs no commitment. A life among other people does. On your second point I agree with you: a commitment that treats others as fuel has betrayed itself. That is a reason to commit well. It is not a reason to commit to nothing.',
          },
        ],
      },
      differ: {
        turns: [
          {
            role: 'synthesis',
            text: 'All three accept that meaning is not handed down, and none thinks that excuses you from committing. The difference is what a commitment is for. The Existentialist lens says it is how things come to matter at all, and that it ties you to other people. The Absurdist lens says commit out of love for the thing, and stop asking it to justify your life. The Pragmatist lens says commit in order to find out, and stay willing to revise. That changes how you would hold a commitment when it gets hard: as a promise to keep, as something you love without a reason, or as a test with results still coming in.',
          },
        ],
      },
    },
  },
];
