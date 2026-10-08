import bcrypt from 'bcryptjs';

// bcryptjs is a pure-JavaScript BCrypt (no native compilation needed on Windows).
// Hashes created by Java's BCryptPasswordEncoder can be verified with it and vice versa.
export function createPasswordEncoder(rounds = 10) {
  return {
    encode: (plainPassword) => bcrypt.hash(plainPassword, rounds),
    matches: (plainPassword, hash) => bcrypt.compare(plainPassword, hash),
  };
}
