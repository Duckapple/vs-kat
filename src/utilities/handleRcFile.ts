const rcKeys = [
  "user",
  "kattis",
  "kat",
  "File associations",
  "Initialize commands",
  "Run commands",
  "Compile commands",
  "Naming",
  "Default options",
  "contest",
] as const;

export type RC = Record<
  (typeof rcKeys)[number],
  Record<string, string> | undefined
>;

export function parseRC(input: string): RC {
  const result: Record<string, Record<string, string>> = {};
  let intermediary: Record<string, string> = result as any;
  for (const line of input.split(/\r?\n/)) {
    if (!line || !line.trim() || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      const matches = /\[(.+)\]/.exec(line);
      if (matches?.[1]) {
        intermediary = {};
        result[matches[1]] = intermediary;
      }
      continue;
    }
    const colonSplit = line.split(": ");
    if (colonSplit.length > 1) {
      const [key, ...rest] = colonSplit;
      const value = rest.join(": ");
      intermediary[key] = value;
    } else {
      const [rawKey, ...rest] = line.split("=");
      const value = rest.join("=").trim();
      intermediary[rawKey.trim()] = value;
    }
  }

  return result as RC;
}

export function printRC(input: RC): string {
  const warning = `# This file includes a secret token that allows you to log in.
# DO NOT SHARE IT WITH ANYONE ELSE.
# If someone gets access to this token, please revoke it by changing your KATTIS password.

`;
  let buffer = warning;

  for (const [key, sectionOrItem] of Object.entries(input)) {
    if (!sectionOrItem) continue;
    if (typeof sectionOrItem === "string") {
      buffer += `${key}: ${sectionOrItem}\n`;
    } else {
      buffer += `[${key}]\n`;
      for (const [key, value] of Object.entries(sectionOrItem)) {
        buffer += `${key}: ${value}\n`;
      }
      buffer += "\n";
    }
  }

  return buffer;
}
