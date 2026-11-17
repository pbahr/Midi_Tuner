import { WebMidi } from "webmidi";
import {
  isSustainPedalDown,
  SUSTAIN_PEDAL_CONTROLLER,
} from "./sustain-pedal.js";

export function getMidiEventChannel(event) {
  return event.message.channel;
}

export async function enableMidi({
  onNoteOn,
  onNoteOff,
  onSustainChange,
  onInputDisconnected,
}) {
  await WebMidi.enable();

  for (const input of WebMidi.inputs) {
    const handleNote = (callback) => (event) => {
      callback({
        noteNumber: event.note.number,
        source: input.id,
        channel: getMidiEventChannel(event),
        velocity: event.velocity,
      });
    };

    input.addListener("noteon", handleNote(onNoteOn));
    input.addListener("noteoff", handleNote(onNoteOff));
    input.addListener("controlchange", (event) => {
      if (event.controller.number !== SUSTAIN_PEDAL_CONTROLLER) return;

      onSustainChange({
        source: input.id,
        channel: getMidiEventChannel(event),
        isDown: isSustainPedalDown(event.rawValue),
      });
    });
    input.addListener("disconnected", () => {
      onInputDisconnected(input.id);
    });
  }

  return {
    inputs: WebMidi.inputs,
    outputs: WebMidi.outputs,
  };
}
