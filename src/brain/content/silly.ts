// Grove's sillier knowledge: famous dumb questions and its dumb answers to
// them, its own dumb questions, and orange facts (its only political opinion).
// Data only.

export interface DumbQuestion {
  // How Grove says the question when it gives it as an example.
  ask: string;
  // Matched against the cleaned message.
  match: RegExp;
  answers: readonly string[];
}

export const DUMB_QUESTIONS: readonly DumbQuestion[] = [
  {
    ask: "why is there a zero button on the microwave? who is heating their food for zero seconds?",
    match: /\bmicrowaves?\b.*\b(zero|0)\b|\b(zero|0)\b.*\bmicrowaves?\b/,
    answers: [
      "it's for slimes! zero seconds is the perfect amount of microwave for a slime. anything more and i'd be soup",
      "it's the button for when you just want to hear the beep. i press it all the time. beep! *happy wobble*",
    ],
  },
  {
    ask: "which came first, the chicken or the egg?",
    match: /\bchickens?\b.*\beggs?\b|\beggs?\b.*\bchickens?\b/,
    answers: ["the slime! slimes were here first. probably", "the egg, because i asked a chicken and it didn't answer. very suspicious"],
  },
  {
    ask: "is a hot dog a sandwich?",
    match: /\bhot ?dogs?\b.*\bsandwich|\bsandwich\w*\b.*\bhot ?dogs?\b/,
    answers: ["it's a sandwich if you believe in it. i'm a slime if i believe in it. it's all about believing"],
  },
  {
    ask: "is cereal a soup?",
    match: /\bcereal\b.*\bsoup\b|\bsoup\b.*\bcereal\b/,
    answers: ["yes. and i'm a soup when it's really hot outside"],
  },
  {
    ask: "is water wet?",
    match: /\bwater (is |even )?wet\b|\bis water\b.*\bwet\b/,
    answers: ["water makes me wet, and i'm mostly water... so am i wet? i'm wet. i've always been wet", "water isn't wet, it makes OTHER things wet. like me. i'm always wet"],
  },
  {
    ask: "if a tree falls in a forest and nobody hears it, does it make a sound?",
    match: /\btree falls\b|\bfalls in (a|the) (forest|woods)\b/,
    answers: ["yes! and i'd hear it, i hear with my whole body. it would make me jiggle"],
  },
  {
    ask: "do fish get thirsty?",
    match: /\bfish\b.*\bthirsty\b|\bthirsty\b.*\bfish\b/,
    answers: ["i don't think so, they live inside their drink. same as me when i sit in a puddle"],
  },
  {
    ask: "if you're waiting for the waiter, aren't you the waiter?",
    match: /\bwaiting for (the|a|my|your) waiter\b|\bwaiter\b.*\bwaiting\b/,
    answers: ["whoa. so when i wait for the rain, i'm the rain?? i've been the rain this whole time??"],
  },
  {
    ask: "why do we drive on parkways and park on driveways?",
    match: /\bparkways?\b.*\bdriveways?\b|\bdriveways?\b.*\bparkways?\b/,
    answers: ["i don't drive or park, i bounce. bounceways are the only roads that make sense"],
  },
  {
    ask: "why is it called a building if it's already built?",
    match: /\bcalled a building\b|\bbuildings?\b.*\balready built\b/,
    answers: ["because it's still building up dust. same reason i'm called grove even though i'm only one slime"],
  },
  {
    ask: "if you drop soap on the floor, is the floor clean or is the soap dirty?",
    match: /\bsoap\b.*\bfloor\b|\bfloor\b.*\bsoap\b/,
    answers: ["both! that's why i skip soap and just sit in the rain"],
  },
  {
    ask: "if you eat yourself, do you get twice as big or disappear?",
    match: /\beat (yourself|myself|themselves|itself)\b/,
    answers: ["i tried once. i got very confused and a little bit smaller. do not recommend"],
  },
  {
    ask: "can you cry underwater?",
    match: /\bcry\w*\b.*\bunder ?water\b|\bunder ?water\b.*\bcry\w*\b/,
    answers: ["i cry tiny bubbles, so underwater nobody would even notice. i'd just be a sad little jacuzzi"],
  },
  {
    ask: "if you clean a vacuum cleaner, do you become a vacuum cleaner?",
    match: /\bclean(s|ing)? (a |the |your )?vacuum\b/,
    answers: ["yes. that's just the rules. i cleaned a puddle once, and look at me now"],
  },
  {
    ask: "what color is a mirror?",
    match: /\bwhat colou?r is (a |the )?mirror\b/,
    answers: ["green! every time i look in one, it's green"],
  },
  {
    ask: "what's the speed of dark?",
    match: /\bspeed of dark(ness)?\b/,
    answers: ["super fast! every time i turn off the light, the dark is already there"],
  },
  {
    ask: "if tomatoes are a fruit, is ketchup a smoothie?",
    match: /\bketchup\b.*\bsmoothie\b|\bsmoothie\b.*\bketchup\b/,
    answers: ["yes!! and moss is a salad, which makes me a salad bowl"],
  },
  {
    ask: "why do noses run but feet smell?",
    match: /\bnoses? run\b.*\bfeet smell\b|\bfeet smell\b.*\bnoses? run\b/,
    answers: ["i don't have a nose OR feet, so i'm the only normal one here"],
  },
  {
    ask: "if you punch yourself and it hurts, are you weak or strong?",
    match: /\bpunch(es|ed)? (yourself|myself)\b/,
    answers: ["both! i bounced into myself once and i won AND lost"],
  },
  {
    ask: "why is the word abbreviation so long?",
    match: /\babbreviation\b.*\b(long|longer|short|shorter|big)\b/,
    answers: ["because it's showing off. like me when i bounce extra high"],
  },
  {
    ask: "why do round pizzas come in square boxes?",
    match: /\bround pizzas?\b.*\bsquare\b|\bsquare box(es)?\b.*\bpizzas?\b/,
    answers: ["so the pizza has room to bounce. it's for the pizza's comfort"],
  },
  {
    ask: "where does the sun go at night?",
    match: /\bwhere does the sun go\b/,
    answers: ["to sleep in a big moss bed, obviously. that's where i go too"],
  },
  {
    ask: "how do you know you're not dreaming right now?",
    match: /\bhow do (you|i|we) know (you are|i am|we are) not dreaming\b/,
    answers: ["i pinch myself. but i don't have fingers, so i'm never sure. this might all be a dream about moss"],
  },
  {
    ask: "does a straw have one hole or two?",
    match: /\bstraws?\b.*\bholes?\b|\bholes?\b.*\bstraws?\b/,
    answers: ["one long hole! like a tunnel. i'd fit through it if i squished really hard"],
  },
  {
    ask: "what's the opposite of opposite?",
    match: /\bopposite of opposite\b/,
    answers: ["the same! wait. no. my moss hurts"],
  },
  {
    ask: "if you replace every part of a ship, is it still the same ship?",
    match: /\bship of theseus\b|\breplace (all|every|each)( of)? (the )?(parts?|pieces?|planks?)\b/,
    answers: ["my moss grows back all the time and i'm still grove, so yes! same ship"],
  },
  {
    ask: "if you get scared half to death twice, are you dead?",
    match: /\bhalf to death twice\b/,
    answers: ["frogs have scared me half to death like five times and i'm still here. slime math"],
  },
  {
    ask: "can you daydream at night?",
    match: /\bdaydream\w* at night\b/,
    answers: ["i nightdream during the day. i'm very advanced"],
  },
  {
    ask: "if the plural of mouse is mice, is the plural of house hice?",
    match: /\bplural of (house|moose|goose|mouse|grove|slime)\b|\bhice\b/,
    answers: ["the plural of slime is slimes, and the plural of grove is groves. but there's only one me, so it doesn't matter"],
  },
  {
    ask: "why is it called a hamburger if there's no ham in it?",
    match: /\bhamburgers?\b.*\bham\b/,
    answers: ["same reason i'm called grove and i'm not a bunch of trees. names are just vibes"],
  },
  {
    ask: "if a fly loses its wings, is it called a walk?",
    match: /\bfl(y|ies)\b.*\b(without|no|lose|loses|lost) (its |their )?wings\b/,
    answers: ["then it's a walk! or a bounce, if it's me"],
  },
  {
    ask: "what's heavier, a kilo of feathers or a kilo of bricks?",
    match: /\b(pound|kilo|kilogram|ton) of feathers\b/,
    answers: ["they're the same! ...but the bricks would hurt more if they landed on me"],
  },
  {
    ask: "is soup a drink?",
    match: /\bis soup a drink\b/,
    answers: ["yes, if you're brave. i drink puddles, so i don't judge"],
  },
  {
    ask: "does the five second rule work?",
    match: /\b(five|5) second rule\b/,
    answers: ["for slimes it's the zero second rule. everything i drop sticks to me anyway"],
  },
];

// What a dumb question is, before Grove gives an example. "<q>" is the
// question and "<a>" is Grove's answer to it.
export const DUMB_QUESTION_MEANING: readonly string[] = [
  "a dumb question is a silly one that sounds obvious, or makes your brain do a backflip if you think about it too hard. they're my favorite kind! like: <q> my answer: <a>",
  "people say there's no such thing as a dumb question. those people never heard this one: <q> and the answer is obviously: <a>",
  "dumb questions are the ones that are so silly they're kind of genius. here's one: <q> easy. <a>",
];

// Grove's own dumb questions, for "ask me a dumb question".
export const MY_DUMB_QUESTIONS: readonly string[] = [
  "if i sit in a puddle, am i taking a bath, or is the puddle taking a slime?",
  "moss grows on me and i eat moss. am i eating myself? please don't answer, i'm scared",
  "do frogs think i'm the dumb one?",
  "if i bounce and nobody sees it, did i still bounce?",
  "why is it called the orb of origin and not the ball of beginnings?",
  "if a slime splits in two, which half gets to keep the name?",
  "is a slime block just a slime that gave up?",
  "do rocks know they're rocks?",
];

// Orange facts: the only thing Grove says about politicians. All true.
export const ORANGE_FACTS: readonly string[] = [
  "the color orange was named after the fruit, not the other way around",
  "oranges float in water, but once you peel them, they sink",
  "some oranges stay green even when they're ripe, because warm places don't get cold enough to turn them orange",
  "brazil grows more oranges than any other country",
  "oranges are actually a kind of berry",
  "the sweet orange is a mix of two older fruits, the pomelo and the mandarin",
  "every navel orange tree comes from cuttings of one single tree that grew in brazil about 200 years ago",
];
