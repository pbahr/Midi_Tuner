export function setupTestControls({ onEnableMidi, onClearEvents }) {
  document
    .querySelector("#enable-midi")
    .addEventListener("click", onEnableMidi);
  document
    .querySelector("#clear-events")
    .addEventListener("click", onClearEvents);
}
