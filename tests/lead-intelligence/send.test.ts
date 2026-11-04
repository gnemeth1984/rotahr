// Offline tests for the Send now composer helpers: demo/tutorial links and the rendered email.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { demoUrl, hasRotahrLink, linksBlock, tutorialsUrl, withLinks } from "../../lib/lead-intelligence/outreach-links";

// send.ts imports the Prisma client, which validates DATABASE_URL on construction. No query is ever made here.
process.env.DATABASE_URL ||= "postgresql://offline@127.0.0.1:1/never_used_test";
const { renderLeadEmail } = await import("../../lib/lead-intelligence/send");

describe("outreach links", () => {
  test("demo and tutorial URLs point at the live pages with campaign tags", () => {
    assert.equal(demoUrl("cold"), "https://rotahr.com/try?utm_source=lead-intelligence&utm_medium=email&utm_campaign=cold");
    assert.match(tutorialsUrl("followup"), /^https:\/\/rotahr\.com\/tutorials\?.*utm_campaign=followup$/);
    assert.ok(linksBlock("cold").includes(demoUrl("cold")) && linksBlock("cold").includes(tutorialsUrl("cold")));
  });
  test("links go above the sign-off", () => {
    const out = withLinks("Hi Mary,\n\nRotas take hours.\n\nKind regards,\nGabor", "cold");
    const linkAt = out.indexOf(demoUrl("cold"));
    assert.ok(linkAt > out.indexOf("Rotas take hours.") && linkAt < out.indexOf("Kind regards,"), out);
    assert.ok(out.endsWith("Kind regards,\nGabor"));
  });
  test("appended when there is no sign-off", () => {
    const out = withLinks("Hi,\n\nQuick one about rotas.", "followup");
    assert.ok(out.startsWith("Hi,\n\nQuick one about rotas.\n\n"));
    assert.ok(out.endsWith(tutorialsUrl("followup")));
  });
  test("no-op when the body already links to the demo, /demo or tutorials", () => {
    for (const body of ["See https://rotahr.com/try", "See rotahr.com/demo", "Videos: https://rotahr.com/tutorials"]) {
      assert.equal(hasRotahrLink(body), true);
      assert.equal(withLinks(body, "cold"), body);
    }
    const once = withLinks("Hello there, about your rotas.", "cold");
    assert.equal(withLinks(once, "cold"), once, "idempotent");
  });
});

describe("renderLeadEmail", () => {
  test("escapes HTML, links URLs and carries a signed unsubscribe link in both parts", () => {
    const body = withLinks("Hi <script>alert(1)</script> & co,\n\nThanks", "cold");
    const { html, text } = renderLeadEmail(body, "Manager@Venue.ie");
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;") && html.includes("&amp; co"));
    assert.ok(html.includes(`<a href="${demoUrl("cold").replace(/&/g, "&amp;")}"`), "demo link is clickable");
    assert.match(html, /https:\/\/rotahr\.com\/unsubscribe\?email=manager%40venue\.ie&amp;t=[0-9a-f]{16}/);
    assert.match(text, /Unsubscribe \(one click\): https:\/\/rotahr\.com\/unsubscribe\?email=manager%40venue\.ie&t=[0-9a-f]{16}/);
    assert.ok(text.includes(demoUrl("cold")));
  });
});
