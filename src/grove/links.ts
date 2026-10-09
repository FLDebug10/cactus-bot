// GIFs reach Grove as links (Tenor, Giphy, Klipy, or a plain .gif file), and
// it can't open a link. The address usually carries the GIF's title though,
// "klipy.com/gifs/rpx-syria-mic-drop-1" is a mic drop, so a GIF link becomes
// "[gif: rpx syria mic drop]" before Grove reads the message.

const GIF_HOSTS = /(?:^|\.)(?:tenor\.com|tenor\.co|giphy\.com|klipy\.com|gfycat\.com|gifer\.com)$/i;
const SECTION = /^(?:view|gifs?|clips?|stickers?|memes?|embed|media|watch)$/i;
const GIF_FILE = /\.(?:gifv?)$/i;
// A link, without the dot or bracket that ends a sentence around it.
const LINK = /https?:\/\/[^\s<>]*[^\s<>.,!?;:)\]'"]/gi;
const TITLE_MAX = 80;
// What apps name a GIF file when it has no real name.
const NO_NAME = /^(?:unknown|image\d*|img[_-]?\d*|giphy|tenor|klipy|download\w*|untitled|animation|video|file)$/i;

// Random ids end GIF addresses: "...-gif-5013258431474633547", "...-3o7TKMt1VVNkHV2PaE", "...-1",
// and name GIF files: "AbCdEfG.gifv".
function isId(token: string): boolean {
  if (/^\d+$/.test(token)) return true;
  if (!/^[A-Za-z0-9]+$/.test(token)) return false;
  if (token.length >= 9 && /\d/.test(token)) return true;
  return token.length >= 5 && /[a-z]/.test(token) && /[A-Z]/.test(token.slice(1));
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// "mic-drop-obama-gif-5013258431474633547" -> "mic drop obama"
function titleOf(slug: string): string {
  const tokens = slug.replace(/\.[a-z0-9]{2,4}$/i, "").split(/[-_+\s]+/).filter(token => token.length > 0);
  while (tokens.length > 0 && isId(tokens[tokens.length - 1]!)) tokens.pop();
  if (tokens.length > 0 && tokens[tokens.length - 1]!.toLowerCase() === "gif") tokens.pop();
  while (tokens.length > 0 && isId(tokens[tokens.length - 1]!)) tokens.pop();
  const title = tokens.join(" ").toLowerCase();
  return title.length <= TITLE_MAX ? title : `${title.slice(0, TITLE_MAX).replace(/\s+\S*$/, "")}`;
}

// null when the link isn't a GIF, otherwise its title ("" when the address has none).
export function gifTitle(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(segment => segment.length > 0).map(safeDecode);
  const file = segments[segments.length - 1] ?? "";
  const gifFile = GIF_FILE.test(file);
  const gifHost = GIF_HOSTS.test(url.hostname);
  if (!gifFile && !gifHost) return null;

  let slug = file;
  if (gifHost) {
    // /view/<title>-gif-<id>, /gifs/<title>-<id>, /de/view/..., /media/<id>/giphy.gif
    const section = segments.findIndex(segment => SECTION.test(segment));
    slug = (section === -1 ? undefined : segments[section + 1]) ?? file;
  }
  const title = titleOf(slug);
  return NO_NAME.test(title) ? "" : title;
}

function label(title: string): string {
  return title.length === 0 ? "[gif]" : `[gif: ${title}]`;
}

// The text with every GIF link swapped for its label. Other links stay as they are.
export function describeGifs(text: string): string {
  if (!text.includes("://")) return text;
  return text
    .replace(/<(https?:\/\/[^\s<>]+)>/g, "$1")
    .replace(LINK, link => {
      const title = gifTitle(link);
      return title === null ? link : label(title);
    });
}

// A GIF someone uploaded, from its file name and type: "[gif: mic drop]". null for other files.
export function gifAttachment(name: string, contentType: string | null): string | null {
  if (!GIF_FILE.test(name) && contentType !== "image/gif") return null;
  const title = titleOf(name);
  return label(NO_NAME.test(title) ? "" : title);
}
