// utils/ids.js


var createId = e => {
  let t = new Uint8Array(8);
  return globalThis.crypto.getRandomValues(t), `${e}-${Array.from(t, e => e.toString(16).padStart(2, `0`)).join(``).toUpperCase()}`;
};

export { createId };
