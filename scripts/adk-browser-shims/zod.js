// AI Vision passes a plain Gemini JSON schema and validates the final action in
// the service worker. ADK imports Zod for optional tools and user-defined
// schemas, so keep only the small compatibility surface needed while bundling
// this single-turn browser planner. This also avoids shipping every locale and
// JIT compiler from the general-purpose Zod package.
function createSchema(kind, shape) {
  const schema = {
    _def: { typeName: kind === 'object' ? 'ZodObject' : kind },
    parse(value) { return value; },
    safeParse(value) { return { success: true, data: value }; }
  };
  schema.optional = () => createSchema(`${kind}Optional`, shape);
  schema.default = (value) => createSchema(`${kind}Default`, shape);
  schema.describe = () => schema;
  schema.min = () => schema;
  schema.max = () => schema;
  schema.regex = () => schema;
  schema.array = () => createSchema('array', schema);
  schema.refine = () => schema;
  schema.loose = () => schema;
  if (kind === 'object') schema.shape = shape || {};
  return schema;
}

export const z = Object.freeze({
  any: () => createSchema('any'),
  array: (item) => createSchema('array', item),
  literal: (value) => createSchema('literal', value),
  object: (shape) => createSchema('object', shape),
  preprocess: (_transform, schema) => schema,
  record: (_key, value) => createSchema('record', value),
  string: () => createSchema('string'),
  unknown: () => createSchema('unknown')
});

export function fromJSONSchema(schema) {
  return createSchema('jsonSchema', schema);
}

export function toJSONSchema(schema) {
  return schema?._jsonSchema || {};
}

export function zodToJsonSchema(schema) {
  return toJSONSchema(schema);
}
