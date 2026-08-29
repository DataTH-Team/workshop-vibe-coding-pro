import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdown } from "../public/markdown.js";

test("renders common Markdown used in assistant answers", () => {
  const html = renderMarkdown("**Siam** ทำรายได้ `360,110` บาท\n\n1. รายได้สูงสุด\n2. AOV ดี");

  assert.match(html, /<strong>Siam<\/strong>/);
  assert.match(html, /<code>360,110<\/code>/);
  assert.match(html, /<ol><li>รายได้สูงสุด<\/li><li>AOV ดี<\/li><\/ol>/);
});

test("escapes raw HTML instead of executing it", () => {
  const html = renderMarkdown('<img src=x onerror="alert(1)"> **safe**');

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<strong>safe<\/strong>/);
});
