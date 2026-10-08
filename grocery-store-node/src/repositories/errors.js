/** Thrown by a repository when a unique index is violated (e.g. the username is already taken). */
export class DuplicateKeyError extends Error {
  constructor(message = 'Duplicate key') {
    super(message);
    this.name = 'DuplicateKeyError';
  }
}
