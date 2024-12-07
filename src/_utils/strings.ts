export function shortener(input: string, max_length: number) {
  if (input.length > max_length + 3) {
    return input.slice(0, max_length).concat("...");
  } else return input;
}
