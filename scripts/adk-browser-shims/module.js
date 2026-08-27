export function createRequire() {
  return () => {
    throw new Error('Node module loading is not available in the extension runtime.');
  };
}
