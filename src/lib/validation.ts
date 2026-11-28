import type { StoreConfig } from "./types";

export const limits = {
  nameMin: 2,
  nameMax: 40,
  pinLength: 6,
  whatsappLength: 11,
  passwordMin: 6,
  messageMax: 500,
  issueMin: 10,
  adminMessageMax: 1000,
  accountNumberMin: 8,
  accountNumberMax: 20,
  priceMax: 999_999,
  planNameMax: 20,
  shortTextMax: 40,
  longTextMax: 800,
  questionMax: 150,
  codeLength: 6,
  ibanMax: 34,
};

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const LETTERS_ONLY = /^[A-Za-z]+( [A-Za-z]+)*$/;
const LETTERS_AND_DIGITS = /^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/;

export function cleanLetters(value: string, max = limits.nameMax) {
  return value.replace(/[^A-Za-z ]/g, "").replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, max);
}

export function cleanLettersAndDigits(value: string, max = limits.planNameMax) {
  return value.replace(/[^A-Za-z0-9 ]/g, "").replace(/^\s+/, "").replace(/\s{2,}/g, " ").slice(0, max);
}

export function cleanDigits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

export function cleanAccountNumber(value: string) {
  const digits = cleanDigits(value, limits.accountNumberMax);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function cleanCode(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").slice(0, limits.codeLength);
}

// The code template puts the code on a line of its own (the third line), so in a message of several
// lines only such a line is a code.
export function codeOnOwnLine(text: string) {
  const lines = text.split("\n").map((line) => line.trim());
  if (lines.length < 2) return "";
  return lines.find((line) => /^[A-Za-z0-9]{6}$/.test(line)) ?? "";
}

export function extractCode(text: string) {
  const trimmed = text.trim();
  if (!/\s/.test(trimmed)) {
    const word = trimmed.replace(/[^A-Za-z0-9]/g, "");
    return word.length === limits.codeLength ? word : "";
  }

  // The portal puts the code on a line of its own, so a line that is only the code wins.
  const ownLine = trimmed.split("\n").map((line) => line.trim()).find((line) => /^[A-Za-z0-9]{6}$/.test(line));
  if (ownLine) return ownLine;

  const codeLike = (part: string) => (part.match(/\b[A-Za-z0-9]{6}\b/g) ?? []).filter((word) => /\d/.test(word) || /^[A-Z]+$/.test(word));
  const colon = trimmed.indexOf(":");
  const code = (colon >= 0 ? codeLike(trimmed.slice(colon + 1))[0] : undefined) ?? codeLike(trimmed)[0];
  return cleanCode(code ?? "");
}

export function validateCode(code: string) {
  if (code.length !== limits.codeLength) return `The premium code must be exactly ${limits.codeLength} letters or numbers.`;
  return null;
}

export function cleanIban(value: string) {
  const characters = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, limits.ibanMax);
  return characters.replace(/(.{4})(?=.)/g, "$1 ");
}

export function cleanEmail(value: string) {
  return value.replace(/\s/g, "").slice(0, 80);
}

export function validateName(name: string, label = "Name") {
  const value = name.trim();
  if (value.length < limits.nameMin) return `${label} must be at least ${limits.nameMin} letters.`;
  if (value.length > limits.nameMax) return `${label} can be at most ${limits.nameMax} letters.`;
  if (!LETTERS_ONLY.test(value)) return `${label} can only contain letters and spaces.`;
  return null;
}

export function validateEmail(email: string) {
  if (!EMAIL_PATTERN.test(email.trim())) return "Please enter a valid email address.";
  return null;
}

export function looksFake(number: string) {
  const rest = number.slice(2);
  return /(\d)\1{3}/.test(rest) || new Set(rest).size <= 3;
}

export function validateWhatsApp(number: string) {
  if (!/^03\d{9}$/.test(number)) return "Please enter your 11-digit WhatsApp number, like 03001234567.";
  if (looksFake(number)) return "Please enter your real WhatsApp number.";
  return null;
}

export function whatsAppLink(number: string, text = "") {
  const link = `https://wa.me/92${number.slice(1)}`;
  return text ? `${link}?text=${encodeURIComponent(text)}` : link;
}

export function validatePin(pin: string) {
  if (!/^\d{6}$/.test(pin)) return "Your PIN must be exactly 6 digits.";
  return null;
}

export function validateMessage(text: string, min = 1, max = limits.messageMax) {
  const value = text.trim();
  if (value.length < min) return min > 1 ? `Please write at least ${min} characters.` : "Please write a message.";
  if (value.length > max) return `Please keep it under ${max} characters.`;
  return null;
}

export function validateConfig(config: StoreConfig) {
  const errors: string[] = [];
  const { settings, plans, methods, faqs } = config;

  if (!LETTERS_ONLY.test(settings.storeName.trim()) || settings.storeName.trim().length > limits.shortTextMax) {
    errors.push("Store name can only contain letters and spaces.");
  }
  if (!settings.welcome.trim()) errors.push("Welcome message cannot be empty.");
  if (!settings.howItWorks.trim()) errors.push("\"How does it work\" answer cannot be empty.");
  const guideSteps = [...settings.usageSteps, ...settings.nextTimeSteps];
  if (settings.usageSteps.length === 0 || settings.nextTimeSteps.length === 0) errors.push("Add at least one step to How to use and Instructions for next time.");
  if (guideSteps.some((step) => !step.text.trim())) errors.push("Steps cannot be empty. Delete the ones you don't need.");
  if (guideSteps.some((step) => step.text.length > limits.longTextMax)) errors.push(`Each step can be at most ${limits.longTextMax} characters.`);
  if (!settings.rejectionMessage.trim()) errors.push("Rejection message cannot be empty.");
  if (!settings.waitForAdminMessage.trim()) errors.push("The waiting message cannot be empty.");
  if (Object.values(settings.menuLock).some((text) => !text.trim())) errors.push("Closed menu messages cannot be empty.");
  if (settings.rejectReasons.length === 0) errors.push("Add at least one rejection reason.");
  if (!settings.support.stillFacingLabel.trim() || !settings.support.resolvedLabel.trim()) errors.push("Support button labels cannot be empty.");
  if (Object.values(settings.messages).some((text) => !text.trim())) errors.push("Bot messages cannot be empty.");
  if (settings.inboxTabs.some((tab) => !tab.label)) errors.push("Inbox tab names cannot be empty.");
  if (!settings.blocking.message.trim()) errors.push("The blocked customer message cannot be empty.");
  if (!settings.blocking.unblockMessage.trim()) errors.push("The unblock message cannot be empty.");
  if (settings.blocking.channelUrl && validateEmail(settings.blocking.channelUrl)) errors.push("Please enter a valid support email.");

  const longTexts = [
    settings.welcome,
    settings.howItWorks,
    settings.rejectionMessage,
    settings.waitForAdminMessage,
    ...Object.values(settings.statusMessages),
    ...Object.values(settings.supportMessages),
    ...Object.values(settings.supportClosedMessages),
    ...Object.values(settings.menuLock),
  ];
  if (longTexts.some((text) => text.length > limits.longTextMax)) errors.push(`Messages can be at most ${limits.longTextMax} characters.`);
  if ([...Object.values(settings.statusMessages), ...Object.values(settings.supportMessages), ...Object.values(settings.supportClosedMessages)].some((text) => !text.trim())) errors.push("Status messages cannot be empty.");

  const { bankName, accountTitle, accountNumber } = settings.bank;
  if (validateName(bankName, "Bank name")) errors.push("Bank name can only contain letters and spaces.");
  if (validateName(accountTitle, "Account title")) errors.push("Account title can only contain letters and spaces.");
  const digits = accountNumber.replace(/\s/g, "");
  if (digits.length < limits.accountNumberMin || digits.length > limits.accountNumberMax) {
    errors.push(`Account number must be ${limits.accountNumberMin} to ${limits.accountNumberMax} digits.`);
  }
  const iban = (settings.bank.iban ?? "").replace(/\s/g, "");
  if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) errors.push("IBAN should look like PK36SCBL0000001123456702.");
  if (!iban && methods.some((method) => method.showIban)) errors.push("Add the IBAN, or turn off Show IBAN for every payment method.");

  for (const plan of plans) {
    if (!LETTERS_AND_DIGITS.test(plan.name.trim())) errors.push(`Plan name "${plan.name || "empty"}" can only contain letters and numbers.`);
    if (plan.price < 1 || plan.price > limits.priceMax) errors.push(`Price for ${plan.name || "a plan"} must be between 1 and ${limits.priceMax.toLocaleString()}.`);
  }
  if (!plans.some((plan) => plan.active)) errors.push("At least one plan must be visible.");

  for (const method of methods) {
    if (!LETTERS_ONLY.test(method.name.trim())) errors.push(`Payment method "${method.name || "empty"}" can only contain letters and spaces.`);
    if (method.steps.length > limits.longTextMax) errors.push(`Steps for ${method.name} are too long.`);
  }
  if (!methods.some((method) => method.active)) errors.push("At least one payment method must be shown.");

  for (const faq of faqs) {
    if (faq.question.length > limits.questionMax) errors.push(`FAQ question is too long: "${faq.question.slice(0, 30)}…"`);
    if (faq.answer.length > limits.longTextMax) errors.push(`FAQ answer is too long for "${faq.question.slice(0, 30)}…"`);
  }

  return errors;
}
