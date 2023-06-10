import fs from "fs";
import puppeteer from "puppeteer";

if (!fs.existsSync("./data")) {
  fs.mkdirSync("./data");
}

async function main() {
  const cgPromise = fetch(
    "https://raw.githubusercontent.com/pancakeswap/token-list/main/src/tokens/coingecko.json"
  );
  const cmcPromise = fetch(
    "https://raw.githubusercontent.com/pancakeswap/token-list/main/src/tokens/cmc.json"
  );
  const pcsPromise = fetch(
    "https://raw.githubusercontent.com/pancakeswap/token-list/main/src/tokens/pancakeswap-mini-extended.json"
  );

  const [cgData, cmcData, pcsData] = await Promise.all([
    cgPromise,
    cmcPromise,
    pcsPromise,
  ]);

  const cgJson = await cgData.json();
  const cmcJson = await cmcData.json();
  const pcsJson = await pcsData.json();

  fs.writeFileSync(
    "./data/cmc.json",
    JSON.stringify(cmcJson, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    "./data/pcs.json",
    JSON.stringify(pcsJson, null, 2),
    "utf-8"
  );

  //Replace 'thumb' with 'small' in all 'logoURI' of cgJson
  const cgJsonModified = cgJson.map((token) => {
    if (token.logoURI) {
      token.logoURI = token.logoURI.replace("thumb", "small");
    }
    return token;
  });

  fs.writeFileSync(
    "./data/cg.json",
    JSON.stringify(cgJsonModified, null, 2),
    "utf-8"
  );
}

main();

(async () => {
  const browser = await puppeteer.launch();

  let tokens = [];
  let currentPage = 1;
  let totalPages = 13;

  while (totalPages === 0 || currentPage <= totalPages) {
    const page = await browser.newPage();
    await page.goto(`https://bscscan.com/tokens?ps=100&p=${currentPage}`);

    if (totalPages === 0) {
      totalPages = await page.evaluate(() => {
        const paginationElement = document.querySelector(
          ".pagination>ul>li:last-child>a"
        );
        return paginationElement ? parseInt(paginationElement.textContent) : 1;
      });
    }

    const newTokens = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table>tbody>tr"));

      return rows.map((row) => {
        const imgElement = row.querySelector(".media>img");
        const linkElement = row.querySelector(".media>.media-body>h3>a");
        const descriptionElement = row.querySelector(".media>.media-body>p");
        const typeElement = row.querySelector(".media>.media-body>span");

        const logoURI = imgElement ? imgElement.src : null;
        const name = linkElement ? linkElement.textContent : null;
        const address = linkElement ? linkElement.href.split("/")[4] : null;

        return (
          logoURI !== "https://bscscan.com/images/main/empty-token.png" && {
            name,
            address,
            logoURI,
          }
        );
      });
    });

    tokens = [...tokens, ...newTokens.filter(Boolean)];

    console.log(`Finished scraping page ${currentPage}`);
    currentPage++;
    await page.close();
  }

  fs.writeFileSync(
    "data/bscscan.json",
    JSON.stringify(tokens, null, 2),
    "utf-8"
  );

  console.log("Saved tokens to bscscan.json");

  await browser.close();
})();
