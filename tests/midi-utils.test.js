import assert from "node:assert/strict";
import test from "node:test";
import { clampMidiValue } from "../src/midi/midi-utils.js";

test("clampMidiValue rounds and clamps values to the MIDI range", () => {
  assert.equal(clampMidiValue(63.6), 64);
  assert.equal(clampMidiValue(-1), 0);
  assert.equal(clampMidiValue(128), 127);
});
