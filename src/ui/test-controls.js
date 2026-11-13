export function setupTestControls({ onEnableMidi }) {
  document
    .querySelector("#enable-midi")
    .addEventListener("click", onEnableMidi);
}
