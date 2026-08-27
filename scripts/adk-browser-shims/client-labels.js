const labels = ['google-adk/browser', 'gl-typescript/extension'];
let currentLabel = null;

export function getClientLabels() {
  return currentLabel ? [...labels, currentLabel] : [...labels];
}

export function runWithClientLabel(label, callback) {
  const previous = currentLabel;
  currentLabel = label;
  try {
    const result = callback();
    if (result?.finally) return result.finally(() => { currentLabel = previous; });
    currentLabel = previous;
    return result;
  } catch (error) {
    currentLabel = previous;
    throw error;
  }
}
