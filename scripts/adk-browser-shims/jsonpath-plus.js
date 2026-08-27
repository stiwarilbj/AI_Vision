// The ADK streaming aggregator only needs JSONPath.toPathArray(). Keep the
// browser bundle CSP-safe by avoiding the full evaluator, which uses dynamic
// Function construction for JSONPath expressions that Agent Mode never uses.
function decodeQuoted(value) {
  if (value[0] === '"') return JSON.parse(value);
  return value.slice(1, -1).replace(/\\([\\\\'])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
}

function toPathArray(path) {
  const input = String(path || '').trim();
  if (input === '$') return ['$'];
  if (!input.startsWith('$')) throw new Error(`Unsupported JSONPath expression: ${input}`);

  const result = ['$'];
  let index = 1;
  while (index < input.length) {
    if (input[index] === '.') {
      index += 1;
      const match = input.slice(index).match(/^[A-Za-z_$][A-Za-z0-9_$-]*/);
      if (!match) throw new Error(`Unsupported JSONPath expression: ${input}`);
      result.push(match[0]);
      index += match[0].length;
      continue;
    }
    if (input[index] === '[') {
      const end = input.indexOf(']', index + 1);
      if (end < 0) throw new Error(`Unsupported JSONPath expression: ${input}`);
      const token = input.slice(index + 1, end).trim();
      if (/^\d+$/.test(token) || token === '*') {
        result.push(token);
      } else if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
        result.push(decodeQuoted(token));
      } else {
        throw new Error(`Unsupported JSONPath expression: ${input}`);
      }
      index = end + 1;
      continue;
    }
    throw new Error(`Unsupported JSONPath expression: ${input}`);
  }
  return result;
}

export const JSONPath = Object.freeze({ toPathArray });
