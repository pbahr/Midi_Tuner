import { WebMidi } from "webmidi";

export async function enableMidi({ onNoteOn }) {
  await WebMidi.enable();

  for (const input of WebMidi.inputs) {
    input.addListener("noteon", (event) => {
      onNoteOn({
        note: event.note.name,
        octave: event.note.octave,
        velocity: event.velocity,
        input: input.name,
      });
    });
  }

  return {
    inputs: WebMidi.inputs,
    outputs: WebMidi.outputs,
  };
}
