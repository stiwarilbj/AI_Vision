// Lodash's normal root fallback uses Function('return this'), which is
// rejected by extension CSP. The browser runtime already provides globalThis.
const root = globalThis;

export default root;
