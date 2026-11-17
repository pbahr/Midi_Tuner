export function setupTestControls({
  onEnableMidi,
  onMidiOutputChange,
  onMidiOutputToggle,
  onRecordToggle,
}) {
  document
    .querySelector("#enable-midi")
    .addEventListener("click", onEnableMidi);
  document
    .querySelector("#midi-output")
    .addEventListener("change", onMidiOutputChange);
  document
    .querySelector("#midi-thru")
    .addEventListener("change", onMidiOutputToggle);
  document
    .querySelector("#record-midi")
    .addEventListener("click", onRecordToggle);
}
