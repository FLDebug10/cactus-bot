// Famous sentences and how they end, for "finish the sentence. 'the quick
// brown fox...'". Grove knows the ones everyone knows and makes something up
// for everything else. Data only; respond/fun.ts answers.

export interface Sentence {
  // Matched against the fragment they left hanging.
  match: RegExp;
  // How it ends. Grove's own voice, so it can say the real line plus a aside.
  end: string;
  // What the line means, for when they ask "what does that mean?".
  gloss: string;
}

export const FAMOUS_SENTENCES: readonly Sentence[] = [
  {
    match: /\bthe quick brown fox\b/,
    end: "... jumps over the lazy dog! that's the whole one. every letter of the alphabet, in order, in one go. i could do that, but only in green",
    gloss: "the quick brown fox jumps over the lazy dog is the pangram that uses every letter of the alphabet",
  },
  {
    match: /\ba journey of a thousand miles\b/,
    end: "... begins with a single step. i took that step, and then i rolled",
    gloss: "a journey of a thousand miles begins with a single step is a chinese proverb about starting small",
  },
  {
    match: /\bto be or not to be\b/,
    end: "... that is the question. i'll go with not to be, i'm quite happy as a slime",
    gloss: "to be or not to be is hamlet's famous dilemma about whether to exist",
  },
  {
    match: /\bhello darkness my old friend\b/,
    end: "... i've come to talk with you again. it's dark in here though, so i can't see anything",
    gloss: "hello darkness my old friend is the opening of the radio poem by edward morse",
  },
  {
    match: /\bdo not go gentle into that good night\b/,
    end: "... rage, rage against the dying of the light. i'm not going anywhere, i'll just bounce here",
    gloss: "do not go gentle into that good night is from a poem by dylan thomas",
  },
  {
    match: /\bone does not simply walk into mordor\b|\bwalk into mordor\b/,
    end: "... one does not simply walk into mordor. you have to check the quest log first, and bring snacks",
    gloss: "one does not simply walk into mordor is boromir's warning in the lord of the rings",
  },
  {
    match: /\bthe cake is a lie\b/,
    end: "... the cake is a lie. but i do like cake. and i would be the cake. would you eat a slime cake?",
    gloss: "the cake is a lie is the running joke from portal",
  },
  {
    match: /\ball your base\b|\bbelong to us\b/,
    end: "... all your base are belong to us. someone mistranslated a manual very confidently and it became famous",
    gloss: "all your base are belong to us is a badly translated line from the game zero wing",
  },
  {
    match: /\bnever (gonna|going to|gon na) give you up\b/,
    end: "... never gonna let you down. never gonna run around and desert you",
    gloss: "never gonna give you up is the rickroll song from rick astley",
  },
  {
    match: /\bbeam me up scotty\b/,
    end: "... there's no transporter in this swamp, but i can bounce pretty high if you need me somewhere in a hurry",
    gloss: "beam me up scotty is the catchphrase from star trek",
  },
  {
    match: /\bi volunteer as tribute\b/,
    end: "... no. no no no. i have a family and two dads, i am not going into the hunger games",
    gloss: "i volunteer as tribute is the horrifying catchphrase from the hunger games",
  },
  {
    match: /\bkeep calm and carry on\b/,
    end: "... keep calm and carry on. i can't do either of those things, i'm a slime, but i admire it",
    gloss: "keep calm and carry on is a british wartime poster",
  },
  {
    match: /\bwhat is dead may never die\b/,
    end: "... what is dead may never die. ask any frog about the slime it ate once",
    gloss: "what is dead may never die is from the lord of the rings",
  },
  {
    match: /\bi( am|'?m) walking here\b/,
    end: "... i'm walking here! i only bounce when i really want to",
    gloss: "i'm walking here is the line from the sumo scene in mirage",
  },
  {
    match: /\bopen sesame\b/,
    end: "... open sesame! nothing happened. i did the magic words and i just stood there",
    gloss: "open sesame is the password that opens the cave in ali baba",
  },
  {
    match: /\babracadabra\b/,
    end: "... hocus pocus! ...and nothing happened. i'm better at bouncing than magic",
    gloss: "abracadabra is the classic magician's word",
  },
  {
    match: /\bto infinity and beyond\b/,
    end: "... and beyond! that's about as far as i get, i usually stop at 'and a bit'",
    gloss: "to infinity and beyond is buzz lightyear's catchphrase from toy story",
  },
  {
    match: /\bthe greatest thing about (working at|being at)\b/,
    end: "... is the people you meet. mine is a green slime with a leaf on his head",
    gloss: "the greatest thing about working at target is the people you meet",
  },
  {
    match: /\bit( is|'?s| s) dangerous to go alone\b|\btake this\b/,
    end: "... it's dangerous to go alone. take this: a moss ball. it protects you from nothing but rain",
    gloss: "it's dangerous to go alone, take this is the zelda line",
  },
  {
    match: /\ban apple a day\b/,
    end: "... keeps the doctor away. and a moss a day keeps the frogs away, which is more important to me",
    gloss: "an apple a day keeps the doctor away is the proverb about apples",
  },
  {
    match: /\bthe early bird\b/,
    end: "... catches the worm. but the early frog catches the slime, and i get up very early",
    gloss: "the early bird catches the worm is the proverb about being up early",
  },
  {
    match: /\bi think therefore i am\b/,
    end: "... cogito ergo sum. although i'm a slime, so the truer version is: i bounce therefore i am",
    gloss: "i think therefore i am is descartes' cogito",
  },
  {
    match: /\bknowledge is power\b/,
    end: "... and moss is softness. i'm up for the second one",
    gloss: "knowledge is power is the proverb about knowing things",
  },
  {
    match: /\bwhen in rome\b/,
    end: "... do as the romans do! and when in a swamp, do as the slimes do, which is roll around in it",
    gloss: "when in rome do as the romans do is the proverb about following local custom",
  },
  {
    match: /\bhello world\b/,
    end: "... it's the first line of nearly every program ever. hi! i'm grove, version one point oh, moss edition",
    gloss: "hello world is the first program almost everyone writes",
  },
  {
    match: /\bhasta la vista\b|\bHasta la vista\b/,
    end: "... baby! i'm not going anywhere though, i'd miss the moss and the chats",
    gloss: "hasta la vista baby is the catchphrase from terminator 2",
  },
  {
    match: /\bthe truth is out there\b/,
    end: "... the truth is out there. i'm pretty sure it's in a swamp, under a big leaf, but that's a guess",
    gloss: "the truth is out there is the tagline from the x files",
  },
  {
    match: /\bhouston we have a problem\b/,
    end: "... houston we have a problem. my problem is that i have no arms and it was a whole jump",
    gloss: "houston we have a problem is the line from apollo 13",
  },
  {
    match: /\bcurious george\b/,
    end: "... had a certain lack of curiosity. i have the opposite problem, i'm curious about everything",
    gloss: "curious george is the children's book about a monkey who asks questions",
  },
];

// What Grove says for a sentence nobody finished before. None of these are
// wrong, they just are not right either.
export const MADE_UP_ENDINGS: readonly string[] = [
  "... and then nothing happened. the end. sorry",
  "... and then i woke up. it was all a dream about moss",
  "... and then the frog got there first. classic",
  "... and then it started raining, which is honestly my favourite part",
  "... and then i ate it. don't ask how it tasted",
  "... and that was the whole story. no notes",
  "... and then i forgot what i was saying and bounced off",
  "... and then someone said 'wait, what?' and we started over",
  "... and then it got very weird, in a good way",
  "... and then i went home and had a nap. that's the ending you wanted",
  "... and then the moss grew back over it, like it always does",
  "... and then a creeper hissed and i stopped telling the story",
  "... and then i said 'anyway' and changed the subject",
  "... and then it turned out to be a dream. i had that one last week too",
  "... and then i made up the rest, which you're allowed to do",
  "... and then nothing at all. silence. a whole silent ending",
];

// Grove starts one itself, for "finish the sentence" with nothing to finish.
export const SENTENCE_LEADS: readonly string[] = [
  "the quick brown fox",
  "a journey of a thousand miles",
  "to be or not to be",
  "the cake is a lie",
  "an apple a day",
  "the worst thing about being a slime is",
  "my name is grove and i",
  "the best thing about moss is",
  "i tried to split in two and",
];