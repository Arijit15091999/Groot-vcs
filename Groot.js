import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

class Groot {
  constructor(rootPath = ".") {
    this.repoPath = path.join(rootPath, ".groot"); // .groot
    this.objectPath = path.join(this.repoPath, "objects"); // .groot/objects
    this.headPath = path.join(this.repoPath, "HEAD"); // .groot/HEAD
    this.indexPath = path.join(this.repoPath, "index");
    this.init();
  }

  async init() {
    await fs.mkdir(this.objectPath, { recursive: true });

    try {
      await fs.writeFile(this.headPath, "", { flag: "wx" });
      await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: "wx" });
    } catch (error) {
      console.log("Groot is already initialized");
    }
  }

  hashObject(content) {
    return crypto.createHash("sha1").update(content).digest("hex");
  }

  async add(fileToBeAdded) {
    const data = await fs.readFile(fileToBeAdded, { encoding: "utf-8" });
    const hash = this.hashObject(data);
    const fileToBeAddedPath = path.join(this.objectPath, hash);
    await fs.writeFile(fileToBeAddedPath, data);
    // add to staging area
    this.updateStagingArea(fileToBeAdded, hash);
    console.log(`Added ${fileToBeAdded}`);
  }

  async updateStagingArea(filePath, fileHash) {
    const index = JSON.parse(
      await fs.readFile(this.indexPath, { encoding: "utf-8" })
    );

    index.push({ path: filePath, hash: fileHash });

    await fs.writeFile(this.indexPath, JSON.stringify(index));
  }
}

const groot = new Groot();
groot.add("sample.txt");
