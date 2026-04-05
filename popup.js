const clientSelect = document.getElementById('default-client');
const oneClickToggle = document.getElementById('one-click');

// Load saved settings
chrome.storage.sync.get({ defaultClient: '', oneClick: false }, (data) => {
  clientSelect.value = data.defaultClient;
  oneClickToggle.checked = data.oneClick;
  updateOneClickState();
});

clientSelect.addEventListener('change', () => {
  chrome.storage.sync.set({ defaultClient: clientSelect.value });
  updateOneClickState();
});

oneClickToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ oneClick: oneClickToggle.checked });
});

function updateOneClickState() {
  // Disable one-click if no default is set
  oneClickToggle.disabled = !clientSelect.value;
  if (!clientSelect.value) {
    oneClickToggle.checked = false;
    chrome.storage.sync.set({ oneClick: false });
  }
}
