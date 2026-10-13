import test from "node:test";
import assert from "node:assert/strict";
import { parseCategory, parseIdList, parseSeasonList, parseStoredIdList } from "../lib/validation";

test("parseCategory only accepts known closet categories", () => {
  assert.equal(parseCategory("tops"), "tops");
  assert.equal(parseCategory("coats"), null);
  assert.equal(parseCategory(42), null);
});

test("parseSeasonList accepts unique known seasons from arrays or JSON", () => {
  assert.deepEqual(parseSeasonList(["summer", "winter", "winter", "monsoon"]), ["summer", "winter"]);
  assert.deepEqual(parseSeasonList('["fall","all-season","fall"]'), ["fall", "all-season"]);
  assert.deepEqual(parseSeasonList("not json"), []);
});

test("parseIdList keeps safe positive unique ids and honors the limit", () => {
  assert.deepEqual(parseIdList([1, "2", 2, -3, 4.5, Number.MAX_SAFE_INTEGER + 1, 3], 3), [1, 2, 3]);
});

test("parseStoredIdList is tolerant of corrupt saved history", () => {
  assert.deepEqual(parseStoredIdList("[4, 5, 5]"), [4, 5]);
  assert.deepEqual(parseStoredIdList("{ nope"), []);
  assert.deepEqual(parseStoredIdList(null), []);
});
