import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeGifs, gifAttachment, gifTitle } from "../../src/grove/links.ts";

describe("gif links", () => {
  it("reads the title out of Klipy, Tenor and Giphy addresses", () => {
    assert.equal(gifTitle("https://klipy.com/gifs/rpx-syria-mic-drop-1"), "rpx syria mic drop");
    assert.equal(gifTitle("https://tenor.com/view/mic-drop-obama-gif-5013258431474633547"), "mic drop obama");
    assert.equal(gifTitle("https://tenor.com/de/view/this-is-fine-fire-gif-12345678"), "this is fine fire");
    assert.equal(gifTitle("https://giphy.com/gifs/thumbs-up-nice-3o7TKMt1VVNkHV2PaE"), "thumbs up nice");
    assert.equal(gifTitle("https://media.tenor.com/AbC123/dancing-cat.gif"), "dancing cat");
  });

  it("knows a gif with no words in its address is still a gif", () => {
    assert.equal(gifTitle("https://tenor.com/bAbC12.gif"), "");
    assert.equal(gifTitle("https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif"), "");
    assert.equal(gifTitle("https://cdn.discordapp.com/attachments/1/2/image0.gif"), "");
    assert.equal(gifTitle("https://i.imgur.com/AbCdEfG.gifv"), "");
  });

  it("leaves every other link alone", () => {
    assert.equal(gifTitle("https://0vergrown.github.io/Handbook/docs/datapack/powers/scale/"), null);
    assert.equal(gifTitle("https://modrinth.com/mod/opoli"), null);
    assert.equal(gifTitle("not a link"), null);
  });

  it("swaps gif links in a message for labels", () => {
    assert.equal(describeGifs("https://klipy.com/gifs/rpx-syria-mic-drop-1"), "[gif: rpx syria mic drop]");
    assert.equal(describeGifs("lol https://tenor.com/view/mic-drop-obama-gif-5013258431474633547."), "lol [gif: mic drop obama].");
    assert.equal(describeGifs("<https://tenor.com/view/wave-hello-gif-99999> and (https://tenor.com/bAbC12.gif)"), "[gif: wave hello] and ([gif])");
    assert.equal(describeGifs("see https://0vergrown.github.io/Handbook/ and https://giphy.com/gifs/cat-vibing-xT9IgzoKnwFNmISR8I"), "see https://0vergrown.github.io/Handbook/ and [gif: cat vibing]");
    assert.equal(describeGifs("no links here"), "no links here");
  });

  it("labels gifs people upload", () => {
    assert.equal(gifAttachment("mic_drop.gif", "image/gif"), "[gif: mic drop]");
    assert.equal(gifAttachment("unknown.gif", "image/gif"), "[gif]");
    assert.equal(gifAttachment("download", "image/gif"), "[gif]");
    assert.equal(gifAttachment("screenshot.png", "image/png"), null);
    assert.equal(gifAttachment("power.json", null), null);
  });
});
