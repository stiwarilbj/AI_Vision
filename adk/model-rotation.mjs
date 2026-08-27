import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const ROTATING_MODELS = Object.freeze([
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
]);

function normalizeState(value, modelCount) {
  const nextIndex = Number.isInteger(value?.nextIndex) && value.nextIndex >= 0
    ? value.nextIndex % modelCount
    : 0;
  const requestCount = Number.isSafeInteger(value?.requestCount) && value.requestCount >= 0
    ? value.requestCount
    : 0;
  return { nextIndex, requestCount };
}

export class ModelRotation {
  constructor({ models = ROTATING_MODELS, stateFile = null } = {}) {
    if (!Array.isArray(models) || models.length === 0) throw new Error('Model rotation requires at least one model.');
    if (models.some((model) => typeof model !== 'string' || !model.trim())) throw new Error('Model rotation contains an invalid model.');
    this.models = Object.freeze(models.map((model) => model.trim()));
    this.stateFile = stateFile;
    this.state = { nextIndex: 0, requestCount: 0 };
    this.loaded = false;
    this.queue = Promise.resolve();
  }

  async load() {
    if (this.loaded) return this.snapshot();
    if (this.stateFile) {
      try {
        this.state = normalizeState(JSON.parse(await readFile(this.stateFile, 'utf8')), this.models.length);
      } catch (error) {
        if (error?.code !== 'ENOENT' && error?.name !== 'SyntaxError') throw error;
        this.state = { nextIndex: 0, requestCount: 0 };
      }
    }
    this.loaded = true;
    return this.snapshot();
  }

  snapshot() {
    return {
      nextIndex: this.state.nextIndex,
      requestCount: this.state.requestCount,
      nextModel: this.models[this.state.nextIndex]
    };
  }

  reserve() {
    const operation = this.queue.then(async () => {
      await this.load();
      const index = this.state.nextIndex;
      const requestNumber = this.state.requestCount + 1;
      this.state = {
        nextIndex: (index + 1) % this.models.length,
        requestCount: requestNumber
      };
      await this.persist();
      return {
        index,
        requestNumber,
        model: this.models[index],
        nextModel: this.models[this.state.nextIndex]
      };
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async persist() {
    if (!this.stateFile) return;
    await mkdir(dirname(this.stateFile), { recursive: true });
    const temporaryFile = `${this.stateFile}.${process.pid}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(this.state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryFile, this.stateFile);
  }
}

