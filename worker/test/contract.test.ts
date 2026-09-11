import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createToken,
  isAllowedMime,
  isValidToken,
  MAX_AUDIO_BYTES,
  normalizeDisplayName,
} from "../src/lib/ids";

const REQUIRED_TABLES = [
  "spaces",
  "members",
  "memories",
  "clips",
  "replies",
  "emoji_replies",
] as const;

function missingCreateTables(sql: string, required: readonly string[]): string[] {
  return required.filter((table) => !new RegExp(`CREATE TABLE ${table}\\b`).test(sql));
}

function migrationSql(): string {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "../migrations");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

describe("API validation contracts", () => {
  it("accepts freshly created tokens", () => {
    expect(isValidToken(createToken())).toBe(true);
  });

  it("rejects unknown tokens", () => {
    expect(isValidToken("short")).toBe(false);
  });

  it("rejects empty display names", () => {
    expect(normalizeDisplayName("")).toBeNull();
  });

  it("allows recording mimes", () => {
    expect(isAllowedMime("audio/mp4")).toBe(true);
    expect(isAllowedMime("audio/webm;codecs=opus")).toBe(true);
  });

  it("duration gate matches upload handler", () => {
    const valid = (ms: number) => Number.isFinite(ms) && ms > 0 && ms <= 90_000;
    expect(valid(0)).toBe(false);
    expect(valid(45000)).toBe(true);
    expect(valid(90001)).toBe(false);
  });

  it("rejects audio over 20 MB", () => {
    expect(MAX_AUDIO_BYTES).toBe(20 * 1024 * 1024);
    expect(21 * 1024 * 1024 > MAX_AUDIO_BYTES).toBe(true);
  });
});

describe("D1 migrations", () => {
  it("creates every table the API queries", () => {
    expect(missingCreateTables(migrationSql(), REQUIRED_TABLES)).toEqual([]);
  });

  it("reports a missing table when SQL is incomplete", () => {
    expect(missingCreateTables("CREATE TABLE spaces (id TEXT);", REQUIRED_TABLES)).toEqual([
      "members",
      "memories",
      "clips",
      "replies",
      "emoji_replies",
    ]);
  });

  it("adds a title column on memories", () => {
    expect(migrationSql()).toMatch(/ALTER TABLE memories ADD COLUMN title TEXT NOT NULL DEFAULT ''/);
  });
});
