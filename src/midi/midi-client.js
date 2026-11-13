import { WebMidi } from "webmidi";

export async function enableMidi({ onNoteOn, onNoteOff, onInputDisconnected }) {
  await WebMidi.enable();

  for (const input of WebMidi.inputs) {
    const handleNote = (callback) => (event) => {
      callback({
        noteNumber: event.note.number,
        source: input.id,
        channel: event.channel,
      });
    };

    input.addListener("noteon", handleNote(onNoteOn));
    input.addListener("noteoff", handleNote(onNoteOff));
    input.addListener("disconnected", () => {
      onInputDisconnected(input.id);
    });
  }

  return {
    inputs: WebMidi.inputs,
    outputs: WebMidi.outputs,
  };
}
