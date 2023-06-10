import { NFTStorage } from "nft.storage";
import { filesFromPath } from "files-from-path";
import output from "./output/tokens.json" assert { type: "json" };
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({
  path: path.resolve("../.env"),
});

const token = process.env.NFT_STORAGE_TOKEN;

async function main() {
  const directoryPath = "./output";
  const files = filesFromPath(directoryPath, {
    pathPrefix: path.resolve(directoryPath),
  });

  const storage = new NFTStorage({ token });

  console.log(`storing files`);
  const cid = await storage.storeDirectory(files);
  const tokens = {};
  output.forEach((token) => {
    tokens[
      token.address
    ] = `https://${cid}.ipfs.nftstorage.link/output/images/${token.address}.webp`;
  });
  fs.writeFileSync("../tokens.json", JSON.stringify(tokens, null, 2));
  console.log(`stored files with CID: ${cid}`);
}
main();
