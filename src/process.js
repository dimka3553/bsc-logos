"use strict";

import path from "path";
import url from "url";
import sharp from "sharp";
import fs from "fs";
import fetch from "node-fetch";
import pcsJson from "./data/pcs.json" assert { type: "json" };
import cmcJson from "./data/cmc.json" assert { type: "json" };
import cgJson from "./data/cg.json" assert { type: "json" };
import bscscanJson from "./data/bscscan.json" assert { type: "json" };

const tokens = [...cmcJson, ...cgJson, ...pcsJson, ...bscscanJson];

// find duplicates lists and remove them

const uniqueTokens = [];
const mapAddresses = new Map();
const processedTokens = [];

tokens.forEach((token) => {
  const lowerCaseAddress = token.address.toLowerCase();
  if (mapAddresses.has(lowerCaseAddress)) {
    const existingToken = mapAddresses.get(lowerCaseAddress);
    existingToken.logoURIs.push(token.logoURI);
  } else {
    token.address = lowerCaseAddress;
    token.logoURIs = [token.logoURI];
    mapAddresses.set(lowerCaseAddress, token);
    uniqueTokens.push(token);
  }
});

// Check if images folder exists, if not, create it
if (!fs.existsSync("data/images")) {
  fs.mkdirSync("data/images");
}

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Download the images
for (const [index, token] of uniqueTokens.entries()) {
  if (!token.logoURIs || !token.logoURIs.length) {
    console.log(
      `Token ${token.address} does not have any logoURIs. Skipping download.`
    );
    continue;
  }
  const imgPath = path.resolve(dirname, "data/images", `${token.address}.png`);
  if (fs.existsSync(imgPath)) {
    console.log(`File ${token.address}.png already exists. Skipping download.`);
    continue;
  }

  const fetchPromises = token.logoURIs.map((uri) => fetch(uri));

  try {
    const response = await Promise.race(fetchPromises);

    if (!response.ok)
      throw new Error(`Failed to download image ${response.statusText}`);

    const buffer = await response.buffer();
    fs.writeFileSync(imgPath, buffer);

    console.log(`Downloaded image for token ${token.address}`);
  } catch (error) {
    console.log(
      `Failed to download image for token ${token.address}: ${error.message}`
    );
    uniqueTokens.splice(index, 1);
  }
  // Sleep for a short period between requests to avoid hitting rate limits
  await new Promise((resolve) => setTimeout(resolve, 1));
}

async function processImages(tokens) {
  const imagesDirectory = path.resolve("./data/images");
  const outputDirectory = path.resolve("./output/images"); // New directory for processed images

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory);
  }

  const files = fs.readdirSync(imagesDirectory);

  for (let file of files) {
    const filePath = path.join(imagesDirectory, file);
    const outputFilePath = path.join(
      outputDirectory,
      path.parse(file).name.toLowerCase() + ".webp"
    ); // Path to save processed image

    // If the processed image already exists, skip processing.
    if (fs.existsSync(outputFilePath)) {
      console.log(
        `Processed image ${file} already exists. Skipping processing.`
      );
      continue;
    }

    try {
      // Ensure the file is an image
      if (
        [".jpeg", ".jpg", ".png", ".gif"].includes(
          path.extname(file).toLowerCase()
        )
      ) {
        await sharp(filePath)
          .resize(64, 64)
          .webp({ quality: 80 }) // Lossy compression
          .toFile(outputFilePath);

        processedTokens.push(
          mapAddresses.get(path.parse(file).name.toLowerCase())
        );
        console.log(`Image ${file} processed successfully.`);
      }
    } catch (error) {
      console.log(`Failed to process image ${file}: ${error.message}`);
      // Remove the token corresponding to the failed image
      const tokenAddress = path.parse(file).name;
      const index = tokens.findIndex((token) => token.address === tokenAddress);
      if (index !== -1) {
        tokens.splice(index, 1);
      }
    }
  }
}

await processImages(uniqueTokens);

fs.writeFileSync(
  "./output/tokens.json",
  JSON.stringify(processedTokens, null, 2)
);
