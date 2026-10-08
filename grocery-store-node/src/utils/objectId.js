// Everywhere in the application ids are plain 24-character hex strings.
// Only the repositories know that MongoDB stores them as ObjectIds.

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

/** Returns the id in its canonical (lower case) form, or null when it is not a valid id. */
export function normalizeObjectId(value) {
  return isValidObjectId(value) ? value.toLowerCase() : null;
}
