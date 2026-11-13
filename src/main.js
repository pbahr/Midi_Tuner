import "./styles.css";
import { createPianoSound } from "./audio/piano-sound.js";
import { enableMidi } from "./midi/midi-client.js";
import { renderDevices } from "./ui/device-list.js";
import { createPiano } from "./ui/piano.js";
import { setupTestControls } from "./ui/test-controls.js";

const status = document.querySelector("#status");
const inputDevices = document.querySelector("#input-devices");
const outputDevices = document.querySelector("#output-devices");
const enableButton = document.querySelector("#enable-midi");
const pianoSound = createPianoSound();
const piano = createPiano(document.querySelector("#piano-keyboard"), {
  onNoteOn: pianoSound.noteOn,
  onNoteOff: pianoSound.noteOff,
  onPitchOffsetChange: pianoSound.setPitchOffset,
});
let midiDevices = null;

setupTestControls({
  onEnableMidi: async () => {
    enableButton.disabled = true;
    status.textContent =
      "Connecting MIDI and loading grand piano samples (first use may take a little while)...";

    const midiPromise = midiDevices
      ? Promise.resolve(midiDevices)
      : enableMidi({
          onNoteOn: piano.noteOn,
          onNoteOff: piano.noteOff,
          onInputDisconnected: piano.clearSource,
        });
    const audioPromise = pianoSound.enable();
    const [midiResult, audioResult] = await Promise.allSettled([
      midiPromise,
      audioPromise,
    ]);

    if (midiResult.status === "fulfilled") {
      midiDevices = midiResult.value;
      renderDevices(inputDevices, midiDevices.inputs);
      renderDevices(outputDevices, midiDevices.outputs);
    }

    if (midiResult.status === "fulfilled" && audioResult.status === "fulfilled") {
      status.textContent = "Ready. Play and release a note to hear the grand piano.";
      return;
    }

    if (midiResult.status === "rejected") {
      const message =
        midiResult.reason instanceof Error
          ? midiResult.reason.message
          : String(midiResult.reason);
      if (audioResult.status === "rejected") {
        const audioMessage =
          audioResult.reason instanceof Error
            ? audioResult.reason.message
            : String(audioResult.reason);
        status.textContent = `Could not enable MIDI (${message}) or piano audio (${audioMessage}). Check browser permissions and your internet connection, then retry.`;
        enableButton.textContent = "Retry MIDI & Audio";
      } else {
        status.textContent = `Could not enable MIDI: ${message}`;
        enableButton.textContent = "Retry MIDI";
      }
      enableButton.disabled = false;
    } else {
      const message =
        audioResult.reason instanceof Error
          ? audioResult.reason.message
          : String(audioResult.reason);
      status.textContent = `MIDI is ready, but piano audio could not load: ${message}. Check your internet connection and retry.`;
      enableButton.textContent = "Retry Piano Audio";
      enableButton.disabled = false;
    }
  },
});
