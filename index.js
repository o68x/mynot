#!/usr/bin/env node

import "dotenv/config";
import { exec } from "child_process";
import chalk from "chalk";
import { Command } from "commander";
// !BUG: it looks like there are some pending promises somewhere
import * as library from "./lib/library.js";

const program = new Command();

program.name("mynot").description("My Notion CLI applications").version();

program
  .command("addnewbooks")
  .description("get the new books in calibre")
  .action(async () => {
    await library.addNewBooks();
  });

program
  .command("lastbook")
  .description("gets the idx of the last book imported in notion")
  .action(async () => {
    const res = await library.getLastCalibreIndexInNotion();
    console.log(chalk.green(`Last index is ${res}`));
    process.exit(0);
  });

  program
  .command("gender")
  .description("gets the idx of the last book imported in notion")
  .argument("<string>", "Author whose sex I want to check")
  .action((str) => {
    exec(`mlr --ojson --icsv cat assets/firstnames.csv | grep ${str}`,
      (e, stdout, stderr) => {
        console.log(stdout);
        console.log(stderr);
        process.exit(0);
      }
    )
  });

program.parseAsync().then(() => {
  console.log("done.");
});
