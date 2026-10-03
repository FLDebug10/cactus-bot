import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachmentIsMedia, embedIsMedia } from "../src/features/mediaGallery.ts";

describe("media gallery", () => {
  it("counts images and videos as media", () => {
    assert.equal(attachmentIsMedia({ contentType: "image/png", name: "shot.png", url: "https://cdn.discordapp.com/x/shot.png" }), true);
    assert.equal(attachmentIsMedia({ contentType: null, name: "clip.MP4", url: "https://cdn.discordapp.com/x/clip.MP4" }), true);
    assert.equal(attachmentIsMedia({ contentType: "application/zip", name: "pack.zip", url: "https://cdn.discordapp.com/x/pack.zip" }), false);
  });

  it("counts link previews with pictures, but not reaction gifs", () => {
    const youtube = { url: "https://www.youtube.com/watch?v=x", image: null, video: { url: "https://www.youtube.com/embed/x" }, thumbnail: { url: "https://i.ytimg.com/x.jpg" } };
    const tenor = { url: "https://tenor.com/view/x", image: null, video: { url: "https://media.tenor.com/x.mp4" }, thumbnail: { url: "https://media.tenor.com/x.png" } };
    const text = { url: "https://example.com", image: null, video: null, thumbnail: null };
    assert.equal(embedIsMedia(youtube as never), true);
    assert.equal(embedIsMedia(tenor as never), false);
    assert.equal(embedIsMedia(text as never), false);
  });
});
