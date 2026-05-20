export function buildInsertValues(count: number, offset = 0): string {
  return Array.from({ length: count }, (_, index) => `$${offset + index + 1}`).join(",");
}

export function buildLineValuePlaceholders(lineCount: number, valueCount: number): string[] {
  return Array.from({ length: lineCount }, (_, lineIndex) => {
    const offset = lineIndex * valueCount;
    return `(${buildInsertValues(valueCount, offset)})`;
  });
}
