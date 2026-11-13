import { formatNoteEvent } from "../midi/midi-events.js";

const eventLog = document.querySelector("#event-log");
const maximumEvents = 100;

export function appendNoteEvent(event) {
  if (eventLog.querySelector(".empty-state")) {
    eventLog.replaceChildren();
  }

  const item = document.createElement("li");
  item.textContent = formatNoteEvent(event);
  eventLog.prepend(item);

  while (eventLog.children.length > maximumEvents) {
    eventLog.lastElementChild.remove();
  }
}

export function clearEventLog() {
  const emptyItem = document.createElement("li");
  emptyItem.className = "empty-state";
  emptyItem.textContent = "Play a note on a connected MIDI device.";
  eventLog.replaceChildren(emptyItem);
}
