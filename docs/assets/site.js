// Every example exists in HTML. JavaScript adds a compact scenario switcher.
if (window.AIVisionReferral) {
  window.AIVisionReferral.apply(document, window.location, document.referrer);
}
const tabs = [...document.querySelectorAll('[data-example]')];
const samples = [...document.querySelectorAll('[data-sample]')];
function selectExample(button) {
  for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab === button));
  for (const sample of samples) sample.hidden = sample.dataset.sample !== button.dataset.example;
  document.querySelector('#sample-status').textContent = `${button.textContent} example. Fictional content and illustrative responses; no API request is made.`;
}
if (tabs.length) {
  document.querySelector('.demo-tabs').hidden = false;
  tabs.forEach(button => button.addEventListener('click', () => selectExample(button)));
  selectExample(tabs[0]);
}
const box = document.querySelector('#lightbox');
let opener;
for (const link of document.querySelectorAll('[data-lightbox]')) {
  link.addEventListener('click', event => {
    if (!box?.showModal) return;
    event.preventDefault();
    opener = link;
    box.querySelector('img').src = link.dataset.lightbox;
    box.querySelector('img').alt = link.querySelector('img').alt;
    box.showModal();
  });
}
box?.querySelector('button').addEventListener('click', () => box.close());
box?.addEventListener('close', () => opener?.focus());
box?.addEventListener('click', event => {
  const r = box.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) box.close();
});
