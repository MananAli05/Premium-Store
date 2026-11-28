import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanCode, cleanIban, codeOnOwnLine, extractCode, validateCode, validateEmail, validatePin, validateWhatsApp } from "../../src/lib/validation.ts";

const portalMessage = (code: string) =>
  `Your premium code for 1 month is: \n\n ${code} \n\nPlease copy and paste it in the App 'Activate with Premium Code'. Don't enter manually to prevent make a mistake`;

test("finds the code on its own line in the portal message", () => {
  assert.equal(extractCode(portalMessage("K7P2QX")), "K7P2QX");
  assert.equal(extractCode(portalMessage("itfify")), "itfify");
  assert.equal(extractCode(portalMessage("123422")), "123422");
});

test("finds a code after a colon or a code-looking word", () => {
  assert.equal(extractCode("Premium code: A9B3C1 enjoy"), "A9B3C1");
  assert.equal(extractCode("Here is your code ABCDEF thanks"), "ABCDEF");
  assert.equal(extractCode("Xid8yf"), "Xid8yf");
});

test("does not mistake ordinary words for a code", () => {
  assert.equal(extractCode("Block duration: how long a user is blocked, set by the admin. Client Change Requests"), "");
  assert.equal(extractCode("Please wait a few minutes"), "");
  assert.equal(extractCode("Blocked"), "");
  assert.equal(extractCode("Hi"), "");
});

test("cleans and validates codes", () => {
  assert.equal(cleanCode(" k7-p2 qx9 "), "k7p2qx");
  assert.equal(validateCode("K7P2QX"), null);
  assert.notEqual(validateCode("K7P2"), null);
});

test("formats IBAN in groups of four", () => {
  assert.equal(cleanIban("pk27mezn0012020109391660"), "PK27 MEZN 0012 0201 0939 1660");
});

test("validates email and PIN", () => {
  assert.equal(validateEmail("someone@gmail.com"), null);
  assert.notEqual(validateEmail("not-an-email"), null);
  assert.equal(validatePin("123456"), null);
  assert.notEqual(validatePin("12ab"), null);
});

test("finds the code on the third line of the code template", () => {
  assert.equal(codeOnOwnLine(portalMessage("6JI4IN")), "6JI4IN");
  assert.equal(codeOnOwnLine(portalMessage("itfify")), "itfify");
  assert.equal(codeOnOwnLine("Blocked"), "");
  assert.equal(codeOnOwnLine("Please wait\nWe are checking"), "");
});

test("made-up WhatsApp numbers are refused", () => {
  assert.equal(validateWhatsApp("03444444444"), "Please enter your real WhatsApp number.");
  assert.equal(validateWhatsApp("03222222222"), "Please enter your real WhatsApp number.");
  assert.equal(validateWhatsApp("03121212121"), "Please enter your real WhatsApp number.");
  for (const number of ["03001122112", "03001123333", "03001331111", "03001122222"]) {
    assert.equal(validateWhatsApp(number), "Please enter your real WhatsApp number.");
  }
  assert.equal(validateWhatsApp("03001234567"), null);
  assert.equal(validateWhatsApp("03119446663"), null);
});
