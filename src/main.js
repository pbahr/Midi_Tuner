import "./styles.css";
import { createPianoSound } from "./audio/piano-sound.js";
import { enableMidi } from "./midi/midi-client.js";
import { createMidiOutputRouter } from "./midi/midi-output.js";
import { renderDevices, renderMidiOutputOptions } from "./ui/device-list.js";
import { createPiano } from "./ui/piano.js";
import { setupTestControls } from "./ui/test-controls.js";

const status = document.querySelector("#status");
const sustainIndicator = document.querySelector("#sustain-indicator");
const inputDevices = document.querySelector("#input-devices");
const outputDevices = document.querySelector("#output-devices");
const midiOutputSelect = document.querySelector("#midi-output");
const midiThruToggle = document.querySelector("#midi-thru");
const enableButton = document.querySelector("#enable-midi");
const pianoSound = createPianoSound();
const midiOutput = createMidiOutputRouter();
const piano = createPiano(document.querySelector("#piano-keyboard"), {
  onNoteOn: (noteNumber, velocity, pitchOffset, source, channel) => {
    pianoSound.noteOn(noteNumber, velocity, pitchOffset, source, channel);
    runMidiOutputAction(() =>
      midiOutput.noteOn(noteNumber, velocity, source, channel),
    );
  },
  onNoteOff: (noteNumber, source, channel) => {
    pianoSound.noteOff(noteNumber, source, channel);
    runMidiOutputAction(() => midiOutput.noteOff(noteNumber, source, channel));
  },
  onPitchOffsetChange: (noteNumber, pitchOffset) => {
    pianoSound.setPitchOffset(noteNumber, pitchOffset);
    runMidiOutputAction(() =>
      midiOutput.setPitchOffset(noteNumber, pitchOffset),
    );
  },
  onSustainChange: (source, channel, isDown, anyPedalDown) => {
    pianoSound.setSustain(source, channel, isDown);
    runMidiOutputAction(() =>
      midiOutput.sustainChange(source, channel, isDown),
    );
    sustainIndicator.textContent = anyPedalDown ? "Sustain on" : "Sustain off";
    sustainIndicator.classList.toggle("is-active", anyPedalDown);
    sustainIndicator.setAttribute("aria-label", `Sustain pedal ${anyPedalDown ? "on" : "off"}`);
  },
});
let midiDevices = null;

function runMidiOutputAction(action) {
  try {
    action();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    midiThruToggle.checked = false;
    try {
      midiOutput.setEnabled(false);
    } catch (releaseError) {
      const releaseMessage =
        releaseError instanceof Error
          ? releaseError.message
          : String(releaseError);
      status.textContent = `MIDI output failed: ${message}. Releasing notes also failed: ${releaseMessage}.`;
      return false;
    }

    status.textContent = `MIDI output failed: ${message}. MIDI thru has been turned off.`;
    return false;
  }
}

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
          onSustainChange: piano.sustainChange,
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
      renderMidiOutputOptions(midiOutputSelect, midiDevices.outputs);
      midiThruToggle.disabled = midiDevices.outputs.length === 0;
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
  onMidiOutputChange: () => {
    const selectedOutput =
      midiDevices?.outputs.find(
        (output) => output.id === midiOutputSelect.value,
      ) ?? null;
    if (!runMidiOutputAction(() => midiOutput.setOutput(selectedOutput))) {
      midiOutputSelect.value = midiOutput.getOutput()?.id ?? "";
      midiThruToggle.disabled = !midiOutput.getOutput();
      return;
    }
    if (!selectedOutput) {
      midiThruToggle.checked = false;
      runMidiOutputAction(() => midiOutput.setEnabled(false));
    }
    midiThruToggle.disabled = !selectedOutput;
  },
  onMidiOutputToggle: () => {
    const isEnabled = midiThruToggle.checked;
    if (runMidiOutputAction(() => midiOutput.setEnabled(isEnabled))) {
      status.textContent = isEnabled
        ? `MIDI thru enabled for ${midiOutput.getOutput().name}.`
        : "MIDI thru disabled.";
    }
  },
});
