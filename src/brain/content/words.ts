// Word lists the reader uses before any understanding happens. Data only.

import { table } from "./table.ts";

const words = (text: string): string[] => text.trim().split(/\s+/);

// Contractions, with and without the apostrophe, since chat drops it half the time.
export const CONTRACTIONS: Readonly<Record<string, readonly string[]>> = table({
  "i'm": ["i", "am"], im: ["i", "am"], "i've": ["i", "have"], ive: ["i", "have"],
  "i'll": ["i", "will"], "i'd": ["i", "would"],
  "you're": ["you", "are"], youre: ["you", "are"], "you've": ["you", "have"], youve: ["you", "have"],
  "you'll": ["you", "will"], youll: ["you", "will"], "you'd": ["you", "would"],
  "we're": ["we", "are"], "they're": ["they", "are"], theyre: ["they", "are"],
  "he's": ["he", "is"], hes: ["he", "is"], "she's": ["she", "is"], shes: ["she", "is"],
  "it's": ["it", "is"], "that's": ["that", "is"], thats: ["that", "is"],
  "what's": ["what", "is"], whats: ["what", "is"], "who's": ["who", "is"], whos: ["who", "is"],
  "how's": ["how", "is"], hows: ["how", "is"], "where's": ["where", "is"], wheres: ["where", "is"],
  "when's": ["when", "is"], "why's": ["why", "is"], "there's": ["there", "is"], theres: ["there", "is"],
  "here's": ["here", "is"], "let's": ["let", "us"],
  "don't": ["do", "not"], dont: ["do", "not"], "doesn't": ["does", "not"], doesnt: ["does", "not"],
  "didn't": ["did", "not"], didnt: ["did", "not"], "can't": ["can", "not"], cant: ["can", "not"],
  cannot: ["can", "not"], "couldn't": ["could", "not"], couldnt: ["could", "not"],
  "won't": ["will", "not"], wont: ["will", "not"], "wouldn't": ["would", "not"], wouldnt: ["would", "not"],
  "shouldn't": ["should", "not"], shouldnt: ["should", "not"], "isn't": ["is", "not"], isnt: ["is", "not"],
  "aren't": ["are", "not"], arent: ["are", "not"], "wasn't": ["was", "not"], wasnt: ["was", "not"],
  "weren't": ["were", "not"], werent: ["were", "not"], "haven't": ["have", "not"], havent: ["have", "not"],
  "hasn't": ["has", "not"], hasnt: ["has", "not"], "ain't": ["is", "not"], aint: ["is", "not"],
  "y'all": ["you", "all"], yall: ["you", "all"], "ya'll": ["you", "all"],
});

// Chat shorthand and slang, expanded into the words they stand for.
export const SLANG: Readonly<Record<string, readonly string[]>> = table({
  u: ["you"], ya: ["you"], yu: ["you"], yuo: ["you"], youu: ["you"], r: ["are"], ur: ["your"], urs: ["yours"],
  k: ["ok"], kk: ["ok"], okie: ["ok"], okey: ["ok"], okay: ["ok"], oki: ["ok"], okk: ["ok"],
  pls: ["please"], plz: ["please"], plss: ["please"], pleasee: ["please"],
  thx: ["thanks"], thnx: ["thanks"], tnx: ["thanks"], thanx: ["thanks"], ty: ["thank", "you"],
  tysm: ["thank", "you", "so", "much"], tyvm: ["thank", "you", "very", "much"],
  np: ["no", "problem"], nw: ["no", "worries"], yw: ["you", "are", "welcome"],
  idk: ["i", "do", "not", "know"], idc: ["i", "do", "not", "care"], ik: ["i", "know"], ikr: ["i", "know", "right"],
  wdym: ["what", "do", "you", "mean"], wym: ["what", "you", "mean"], wyd: ["what", "are", "you", "doing"],
  wbu: ["what", "about", "you"], hbu: ["how", "about", "you"], hru: ["how", "are", "you"],
  hwu: ["how", "are", "you"], sup: ["what", "is", "up"], wassup: ["what", "is", "up"], wsp: ["what", "is", "up"],
  wazzup: ["what", "is", "up"], whatsup: ["what", "is", "up"], whassup: ["what", "is", "up"],
  rn: ["right", "now"], tbh: ["to", "be", "honest"], ngl: ["not", "gonna", "lie"], imo: ["in", "my", "opinion"],
  imho: ["in", "my", "opinion"], btw: ["by", "the", "way"], fyi: ["for", "your", "information"],
  bc: ["because"], cuz: ["because"], cus: ["because"], coz: ["because"], bcs: ["because"],
  gonna: ["going", "to"], wanna: ["want", "to"], gotta: ["got", "to"], kinda: ["kind", "of"],
  sorta: ["sort", "of"], lemme: ["let", "me"], gimme: ["give", "me"], dunno: ["do", "not", "know"],
  wat: ["what"], wut: ["what"], wht: ["what"], whta: ["what"], waht: ["what"], wha: ["what"],
  hw: ["how"], hwo: ["how"], wen: ["when"], wher: ["where"], whr: ["where"],
  abt: ["about"], tho: ["though"], thru: ["through"], ppl: ["people"], smth: ["something"], sth: ["something"],
  smthn: ["something"], nvm: ["never", "mind"], mb: ["my", "bad"], ofc: ["of", "course"],
  gn: ["good", "night"], gm: ["good", "morning"], ge: ["good", "evening"], gnight: ["good", "night"],
  nite: ["night"], tmr: ["tomorrow"], tmrw: ["tomorrow"], "2day": ["today"], "2morrow": ["tomorrow"],
  cya: ["see", "you"], cu: ["see", "you"], ttyl: ["talk", "to", "you", "later"], gtg: ["got", "to", "go"],
  g2g: ["got", "to", "go"], brb: ["be", "right", "back"], afk: ["away"],
  luv: ["love"], lov: ["love"], ily: ["i", "love", "you"], ilysm: ["i", "love", "you", "so", "much"],
  hii: ["hi"], hai: ["hi"], haii: ["hi"], hiya: ["hi"], heya: ["hey"], heyy: ["hey"], hallo: ["hello"],
  helo: ["hello"], hellow: ["hello"], ello: ["hello"], yo: ["hey"], yoo: ["hey"], hewwo: ["hello"],
  ye: ["yes"], yea: ["yes"], yeah: ["yes"], yeh: ["yes"], yep: ["yes"], yup: ["yes"],
  yuh: ["yes"], yas: ["yes"], yass: ["yes"], ofcourse: ["of", "course"],
  nah: ["no"], naw: ["no"], nope: ["no"], nop: ["no"], noo: ["no"], nuh: ["no"],
  dum: ["dumb"], dumbb: ["dumb"], stoopid: ["stupid"], stpid: ["stupid"], stupd: ["stupid"],
  qt: ["cute"], kewl: ["cool"], kool: ["cool"], gud: ["good"], gr8: ["great"], b4: ["before"],
  gurl: ["girl"], grl: ["girl"], gril: ["girl"], boi: ["boy"], bois: ["boys"], gal: ["girl"],
  m8: ["mate"], bro: ["bro"], bruh: ["bruh"], fr: ["for", "real"], frfr: ["for", "real"],
  ong: ["for", "real"], deadass: ["for", "real"], istg: ["i", "swear"], lowkey: ["lowkey"],
  highkey: ["highkey"], ez: ["easy"], gg: ["good", "game"], ggs: ["good", "game"], tf: ["tf"], wtf: ["wtf"],
  wth: ["wtf"], wtaf: ["wtf"], stfu: ["shut", "up"], shuttup: ["shut", "up"], stahp: ["stop"],
  irl: ["in", "real", "life"], dm: ["dm"], dms: ["dm"], pfp: ["profile", "picture"],
  pic: ["picture"], pics: ["pictures"], vid: ["video"], vids: ["videos"], ss: ["screenshot"],
  sc: ["screenshot"], dp: ["datapack"], dps: ["datapacks"], rp: ["resourcepack"], rps: ["resourcepacks"],
  tp: ["texturepack"], mc: ["minecraft"], neo: ["neoforge"], nf: ["neoforge"], cf: ["curseforge"],
  mr: ["modrinth"], plsss: ["please"], thnks: ["thanks"], tyy: ["thank", "you"],
  srry: ["sorry"], sry: ["sorry"], soz: ["sorry"], sowwy: ["sorry"], sorryy: ["sorry"],
  morn: ["morning"], mornin: ["morning"], evenin: ["evening"], nighty: ["night"],
  goodnight: ["good", "night"], goodmorning: ["good", "morning"], gday: ["good", "day"],
  alr: ["alright"], aight: ["alright"], ight: ["alright"], iight: ["alright"], alrighty: ["alright"],
  prolly: ["probably"], probs: ["probably"], def: ["definitely"], defo: ["definitely"],
  rly: ["really"], rlly: ["really"], realy: ["really"], srsly: ["seriously"], obv: ["obviously"],
  obvi: ["obviously"], tbf: ["to", "be", "fair"], iirc: ["if", "i", "remember", "correctly"],
  jk: ["just", "kidding"], jkjk: ["just", "kidding"], smh: ["smh"], omg: ["omg"], omfg: ["omg"],
  whatchu: ["what", "you"],
  whatcha: ["what", "are", "you"], watcha: ["what", "are", "you"], wassap: ["what", "is", "up"],
  howdy: ["howdy"], cmon: ["come", "on"], c: ["see"], n: ["and"],
  gf: ["girlfriend"], bf: ["boyfriend"], bff: ["best", "friend"], fav: ["favorite"], fave: ["favorite"],
  favourite: ["favorite"], favorit: ["favorite"], favrite: ["favorite"],
});

// Laughter, in all its spellings. "😭" and "💀" count: that is how people laugh now.
export const LAUGH_WORDS = new Set(words(`
  lol lool loool lolol lolz lul lel lmao lmfao lmaoo lmaooo rofl roflmao haha hahaha hahahaha ha hah
  hehe hehehe heh xd xdd kek kekw ded dead dying crying 😂 🤣 😭 💀 😹 😆
`));

// Words that only open or pad a sentence. Stripping them exposes the real clause:
// "hey grove so um are you a slime" reads as "are you a slime".
export const LEADING_FILLERS = new Set(words(`
  hey hi hello heya hiya howdy yo oi greetings so um uh uhh umm erm well ok alright bro bruh dude
  man lol lmao omg wait hmm hm hmmm oh ah ahh ooh yay also and but btw anyway anyways actually
  like listen look quick question real quick ayo ayy aye okay please just
`));

export const TRAILING_FILLERS = new Set(words(`
  lol lmao please pls bro bruh dude man haha hehe xd though tho rn fr frfr ong ngl honestly lmfao
`));

// The words Grove knows at all. Tokens on this list are never "corrected".
export const KNOWN_WORDS = new Set(words(`
  a about above across act action actually add added after again against age ago ahead air all allowed
  almost alone along already alright also always am amazing among an and angry animal annoying another
  answer any anybody anyone anything anyway anywhere app apple april are area arm around art as ask asked
  asking at attack aunt away awesome awful baby back bad bag ball balls bank base basically basketball
  bat be beach bear beat beautiful became because become bed bee been before began begin behind being
  believe bell best better between big bike bird birthday bit bite black blame bless block blocks blood
  blue board boat body bonus book boost bored boring born boss both bottom bounce bought box boy brain
  brand bread break breakfast bright bring broke brother brought brown bud build building built bunch
  burn bus busy but buy by cake call called calm came camera can cannot car card care careful cat catch
  caught cause cell center certain chair chance change chat cheap check cheese chicken child children
  choice choose chose church city class clean clear click climb clock close closed cloud club code coffee
  cold color come comes coming common community company complete computer confused cook cookie cool copy
  corner correct cost could count country couple course cousin cover cow crazy create created cream
  creative creature crew cried cross crowd cry cup cut cute dad daily damn dance dark date daughter day
  days dead deal dear death decide decided deep definitely delete design desk detail did die different
  dinner dirt dirty discord do doctor does dog doing done door double down draw drawing dream dress
  drink drive drop drove dry duck during each early earth easy eat eaten egg eight either else empty
  end energy english enjoy enough enter entire even evening event ever every everybody everyone
  everything exactly example except excited exciting exist expect expensive explain eye eyes face fact
  fair fall family fan far farm fast father fear feel feeling feet fell felt few field fight figure
  file fill final finally find fine finger finish finished fire first fish five fix fixed flat floor
  flower flowers fly follow food foot for forever forget forgot form forward found four free fresh
  friday friend friends from front fruit full fun funny future game games garden gave general get gets
  getting gift girl give given glad glass go god goes going gold gone good got great green ground group
  grow grown guess guy guys hair half hall hand hands happen happened happy hard has hat hate have he
  head health hear heard heart heavy held hell hello help her here hey hi hide high hill him himself his
  history hit hold hole home honest hope horse hospital hot hotel hour hours house how huge human
  hundred hungry hurt husband i ice idea if important in inside instead interesting into is island it
  item its itself job join joke jump june just keep kept key kid kids kill kind king kitchen knew know
  known lady lake land language large last late later laugh law lay lazy lead learn least leave left leg
  less let letter level library lie life light like liked line list listen little live lived lives
  living load local lock long look looked looking lose lost lot lots loud love loved low luck lucky lunch
  machine mad made make makes making man many map mark market married match matter may maybe me mean
  meant meet meeting member memory men message met middle might mind mine minute minutes miss missed
  mistake mom moment monday money monkey month months mood moon more morning most mother mouth move
  moved movie much mum music must my myself name named near need needed needs neither never new news
  next nice night nine no nobody noise none nor normal north nose not note nothing notice now number
  of off offer office often oh oil ok old on once one online only open opinion or orange order other
  others our out outside over own page paid paint pair paper parent parents park part party pass past
  pay peace people perfect person phone pick picture piece pink place plan plant play played player
  players playing please plus pocket point police pool poor popular possible post power pretty price
  print private probably problem program proud pull purple push put question quick quiet quite race
  rain raise ran random rather reach read ready real really reason red remember rest result return rich
  ride right ring river road rock roll room round rule run running sad safe said salt same saturday
  save saw say saying says scared school score sea season second secret see seem seen sell send sense
  sent serious set seven several shall shape share she ship shirt shoe shoes shop short should shout
  show shut sick side sign silly simple since sing single sister sit six size skin sky sleep slow small
  smart smell smile snow so some somebody someone something sometimes son song soon sorry sort sound
  south space speak special spend spent spider sport spring square stand star start started state stay
  step still stone stop store story strange street strong student study stuff stupid such sugar summer
  sun sunday super sure surprise sweet swim system table take taken talk talking tall taste tea teach
  teacher team tell ten terrible test than thank thanks that the their them then there these they thing
  things think thinking third this those though thought three through throw thursday time tiny tired
  title to today together told tomorrow tonight too took top total touch town toy train tree trip
  trouble true trust truth try trying tuesday turn twice two type uncle under understand until up upon
  us use used useful usual very video view visit voice wait wake walk wall want wanted war warm was
  wash watch water way we wear weather wednesday week weekend weird welcome well went were west wet
  what whatever when where whether which while white who whole why wife wild will win wind window
  winter wish with without woke woman women won wonder wonderful word words work worked working world
  worried worry worse worst would write writing written wrong yard yeah year years yellow yes yesterday
  yet you young your yours yourself youtube zero
  minecraft mod mods modpack server servers world worlds biome biomes chunk chunks creeper creepers
  zombie zombies skeleton enderman endermen ender dragon nether overworld diamond diamonds netherite
  redstone villager villagers piglin axolotl frog frogs slime slimes slimeball magma cube cubes mob mobs
  spawn spawned spawning seed survival hardcore shader shaders texture textures sword pickaxe armor
  elytra trident potion potions enchant enchantment beacon portal cave caves mine mining craft crafting
  inventory hotbar health hunger xp lag laggy fps ping pvp smp realm realms bedrock java edition
  command commands function functions scoreboard tag tags recipe recipes loot table predicate
  advancement advancements namespace folder file files json mcmeta mcfunction folder zip
  bot bots robot ai human alive real chatgpt
  lol lmao bruh bro dude fr ngl tbh idk omg rizz sigma skibidi ohio gyatt mewing cap bussin sus
  slay based mid goated drip vibe vibes vibing yeet cringe simp stan ratio poggers pog bet ate
  sheesh delulu bestie
`));

// Words worth fixing typos toward: the ones whole intents and routes hinge on.
// Correction never targets anything outside this list, so a stray word can
// only ever be left alone, never turned into a different meaning.
export const CORRECTION_TARGETS = new Set(words(`
  datapack datapacks resourcepack resourcepacks texturepack handbook wiki documentation suggestion
  suggestions suggest submission submissions submit gallery media screenshot screenshots video videos
  crash crashing crashed crashes error errors broken glitch glitched bugged problem problems trouble
  issue issues apoli origins origin overgrown overgrowns modrinth curseforge neoforge fabric forge quilt
  minecraft addon addons mixin gradle java json power powers layer layers badge badges function
  functions command commands scoreboard advancement recipe texture textures model models sprite
  gender pronouns pronoun birthday favorite stupid dumb idiot useless annoying funny cute adorable smart
  clever awesome amazing beautiful pretty gorgeous lovely thanks thank please sorry hello morning
  evening night today question install installed installing download downloading version versions update
  competition theme deadline discussion channel report reporting feature features working doesnt
  understand explain mean meaning wonderful sweetheart girl boy female male nonbinary creator created
  annoying terrible horrible awful boring weird creepy ugly disgusting trash garbage worthless pathetic
  merling enderian arachnid avian blazeborn buzzborne elytrian feline human phantom shulk slimekin
  slime frog frogs basketball favourite birthday sentient conscious robot artificial program
  jam jams entry entries contest
`));
