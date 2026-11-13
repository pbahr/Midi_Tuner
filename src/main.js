import "./styles.css";
import { enableMidi } from "./midi/midi-client.js";
import { renderDevices } from "./ui/device-list.js";
import { createPiano } from "./ui/piano.js";
import { setupTestControls } from "./ui/test-controls.js";

const status = document.querySelector("#status");
const inputDevices = document.querySelector("#input-devices");
const outputDevices = document.querySelector("#output-devices");
const enableButton = document.querySelector("#enable-midi");
const piano = createPiano(document.querySelector("#piano-keyboard"));

setupTestControls({
  onEnableMidi: async () => {
    enableButton.disabled = true;
    status.textContent = "Requesting MIDI access...";

    try {
      const devices = await enableMidi({
        onNoteOn: piano.noteOn,
        onNoteOff: piano.noteOff,
        onInputDisconnected: piano.clearSource,
      });

      renderDevices(inputDevices, devices.inputs);
      renderDevices(outputDevices, devices.outputs);
      status.textContent = "MIDI is enabled. Play and release a note to test an input.";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = `Could not enable MIDI: ${message}`;
      enableButton.disabled = false;
    }
  },
});
