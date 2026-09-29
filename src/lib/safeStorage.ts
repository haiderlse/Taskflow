/** localStorage can be missing or throw (private windows, blocked site data); a lost remembered choice is never an error. */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // nothing to do: the choice is simply asked or fired again next time
  }
}
