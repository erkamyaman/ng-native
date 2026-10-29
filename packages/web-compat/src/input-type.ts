/** The input types HTML knows. An input of any other type, or none, is a text field. */
export const INPUT_TYPES = [
  'hidden',
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
  'number',
  'range',
  'color',
  'checkbox',
  'radio',
  'file',
  'submit',
  'image',
  'reset',
  'button',
];

const KNOWN = new Set<string>(INPUT_TYPES);

/** An input's type as its attribute says it, or `text` for one of no type HTML knows. */
export const inputTypeOf = (value: unknown): string => {
  const type = String(value ?? 'text').toLowerCase();
  return KNOWN.has(type) ? type : 'text';
};
