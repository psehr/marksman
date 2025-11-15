/**
 * Shortens a string input to a defined length and appends "..." at the end.
 * @param input The input string to be shortened.
 * @param max_length The character length that will be shortened to.
 * @returns If the input string was long enough, a shorter string, otherwise returns the input string.
 */
export function shortener(input: string, max_length: number) {
  if (input.length > max_length + 3) {
    return input.slice(0, max_length).concat("...");
  } else return input;
}
