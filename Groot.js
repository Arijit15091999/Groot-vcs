#!/usr/bin/env node

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { diffLines } from "diff";
import chalk from "chalk";

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
    await this.updateStagingArea(fileToBeAdded, hash);
    console.log(`Added ${fileToBeAdded}`);
  }

  async updateStagingArea(filePath, fileHash) {
    const index = JSON.parse(
      await fs.readFile(this.indexPath, { encoding: "utf-8" })
    );

    index.push({ path: filePath, hash: fileHash });

    await fs.writeFile(this.indexPath, JSON.stringify(index));
  }

  async commit(message) {
    const index = JSON.parse(
      await fs.readFile(this.indexPath, { encoding: "utf-8" })
    );
    const parentCommit = await this.getCurrentHead();

    // console.log(index);

    const commitData = {
      date: new Date().toISOString(),
      parent: parentCommit,
      message,
      files: index,
    };

    const commitDataHash = this.hashObject(JSON.stringify(commitData));
    const commitDataPath = path.join(this.objectPath, commitDataHash);
    await fs.writeFile(commitDataPath, JSON.stringify(commitData));
    await fs.writeFile(this.headPath, commitDataHash);
    await fs.writeFile(this.indexPath, JSON.stringify([]));
    console.log("Commit successfullly created : " + commitDataHash);
  }

  async getCurrentHead() {
    try {
      return await fs.readFile(this.headPath, { encoding: "utf-8" });
    } catch (error) {
      return null;
    }
  }

  async log() {
    let currentCommitHash = await this.getCurrentHead();

    while (currentCommitHash) {
      const commitData = JSON.parse(
        await fs.readFile(path.join(this.objectPath, currentCommitHash), {
          encoding: "utf-8",
        })
      );

      console.log(`
        Commit: ${currentCommitHash}\n
        message: ${commitData.message}\n
        date: ${commitData.date}\n\n
      `);

      currentCommitHash = commitData.parent;
    }
  }

  async showCommitDiff(commitHash) {
    const commitData = JSON.parse(await this.getCommitData(commitHash));

    if (!commitData) {
      process.stdout.write("Commit not found");
      return;
    }

    if (commitData.parent) {
      console.log("changes in the commit are : ");

      for (const file of commitData.files) {
        console.log(`File: ${file.path}`);

        const fileContent = await this.getFileContent(file.hash);
        const parentCommitData = JSON.parse(
          await this.getCommitData(commitData.parent)
        );

        const parentFileContent = await this.getParentFileContent(
          parentCommitData,
          file.path
        );

        if (parentFileContent != undefined) {
          const diff = diffLines(fileContent, parentFileContent);
          console.log(diff);
          diff.forEach((part) => {
            if (part.added) {
              console.log(chalk.green(`+++ ${part.value}`));
            } else if (part.removed) {
              console.log(chalk.red(`---${part.value}`));
            } else {
              console.log(chalk.grey(`${part.value}`));
            }
          });
        } else {
          console.log(
            chalk.green(`+++New File : ${file.path} is added to the commit`)
          );
        }
      }
    } else {
      console.log("Initail Commit");
    }
  }

  async getParentFileContent(parentCommitData, filePath) {
    const parentFile = parentCommitData.files.find(
      (file) => file.path === filePath
    );

    if (parentFile) {
      return await this.getFileContent(parentFile.hash);
    }
  }

  async getFileContent(fileHash) {
    const filePath = path.join(this.objectPath, fileHash);

    try {
      return await fs.readFile(filePath, { encoding: "utf-8" });
    } catch (error) {
      console.log("failed to read file: ", error);
      return null;
    }
  }

  async getCommitData(commitHash) {
    const commitPath = path.join(this.objectPath, commitHash);

    try {
      return await fs.readFile(commitPath, { encoding: "utf-8" });
    } catch (error) {
      process.stdout.write("Failed to read commit data : ", error);
      return null;
    }
  }
}

(async () => {
  const groot = new Groot();
  // await groot.add("sample.txt");
  // await groot.add("sample2.txt");
  // await groot.commit("2nd commit");
  await groot.showCommitDiff('8f4d3e92c2248a2887649cd324b84060d97d1fe8');
  // await groot.log();
})();
