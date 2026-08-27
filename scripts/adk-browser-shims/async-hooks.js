export class AsyncLocalStorage {
  constructor() {
    this.value = undefined;
  }

  getStore() {
    return this.value;
  }

  run(value, callback) {
    const previous = this.value;
    this.value = value;
    try {
      const result = callback();
      if (result?.finally) return result.finally(() => { this.value = previous; });
      this.value = previous;
      return result;
    } catch (error) {
      this.value = previous;
      throw error;
    }
  }
}
