import { chromium } from "file:///C:/Users/n1htll/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
  await expectText(page, "Kapsejladsapp");
  await expectText(page, "Torsdagssejlads");
  await expectText(page, "DH Klasse A");

  await page.getByRole("button", { name: "Både" }).click();
  await expectText(page, "Tilføj båd manuelt");
  await expectText(page, "Bådliste og målgangskø");

  await page.getByRole("button", { name: "Løb" }).click();
  await expectText(page, "Opret nyt event/løb");
  await expectText(page, "Opret event/løb");
  await expectText(page, "Startstander");
  await expectText(page, "Talstander");
  await expectText(page, "J/70");
  await expectText(page, "X-99");
  await expectText(page, "Optimist");
  await expectText(page, "Formula 18");

  await page.getByRole("button", { name: "Start" }).click();
  await page.locator("#startCountdown").waitFor();
  await expectText(page, "Ekstra signaler");
  await expectText(page, "Generel tilbagekaldelse");
  const generalRecallToggle = page.locator('[data-toggle-manual-signal="general-recall"]');
  if ((await generalRecallToggle.getAttribute("aria-pressed")) !== "true") {
    await generalRecallToggle.click();
  }
  await page.waitForFunction(
    () => document.querySelector('[data-toggle-manual-signal="general-recall"]')?.getAttribute("aria-pressed") === "true",
    null,
    { timeout: 3000 }
  );
  await expectText(page, "Varselssignal");
  await expectText(page, "Åbn ekstern startskærm");
  const startId = await page.evaluate(async () => {
    const events = await fetch("/api/events").then((response) => response.json());
    return events[0].starts[0].id;
  });
  const displayPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await displayPage.goto(`http://localhost:4173/display.html?startId=${startId}`, { waitUntil: "networkidle" });
  await expectText(displayPage, "SIGNALFLAG");
  await expectText(displayPage, "EKSTRA SIGNALER");
  await expectText(displayPage, "GENEREL TILBAGEKALDELSE");
  await page.locator("#startCountdown").click();
  await displayPage.waitForFunction(
    () => document.body.innerText.includes("Varselssignal") || document.body.innerText.includes("Klassestander"),
    null,
    { timeout: 3000 }
  );

  await page.getByRole("button", { name: "Målgang" }).click();
  await expectText(page, "Klar til målgang");
  await expectText(page, "Målgang");
  if (await page.getByRole("button", { name: "Ret båd" }).count()) {
    await expectText(page, "Ret båd");
    await expectText(page, "Øverst");
    await expectText(page, "Træk");
    await page.getByRole("button", { name: "Ret båd" }).first().click();
    await expectText(page, "Gem båd");
    await expectText(page, "Sejlnummer");
  }

  await page.getByRole("button", { name: "Indstillinger" }).click();
  await expectText(page, "Signallyd");
  await expectText(page, "Elektronisk");
  await expectText(page, "Tågehorn");
  await expectText(page, "Skibsklokke");
  await expectText(page, "Party Mode");
  await expectText(page, "Vis konfetti");

  console.log("Browser smoke-test bestået.");
} finally {
  await browser.close();
}

async function expectText(page, text) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    text,
    { timeout: 5000 }
  );
}
