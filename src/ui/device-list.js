export function renderDevices(listElement, devices) {
  listElement.replaceChildren();

  if (devices.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No devices found.";
    listElement.append(emptyItem);
    return;
  }

  for (const device of devices) {
    const item = document.createElement("li");
    item.textContent = device.name;
    listElement.append(item);
  }
}

export function renderMidiOutputOptions(selectElement, devices) {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent =
    devices.length > 0 ? "Choose an output device" : "No output devices found";
  selectElement.replaceChildren(placeholder);

  for (const device of devices) {
    const option = document.createElement("option");
    option.value = device.id;
    option.textContent = device.name;
    selectElement.append(option);
  }

  selectElement.disabled = devices.length === 0;
}
