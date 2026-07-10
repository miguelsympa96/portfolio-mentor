import fs from "fs";
import path from "path";

let cachedRubric: string | null = null;

export function loadRubric(): string {
  if (cachedRubric) return cachedRubric;
  const filePath = path.join(
    process.cwd(),
    ".claude/skills/portfolio-mentor/SKILL.md"
  );
  cachedRubric = fs.readFileSync(filePath, "utf-8");
  return cachedRubric;
}

export { CATEGORIES } from "./types";
