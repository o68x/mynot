#!/usr/bin/env node

import "dotenv/config";
import * as library from "./lib/library.js";
import chalk from "chalk";
import { Command } from "commander";

const program = new Command();

program.name("mynot").description("My Notion CLI applications").version();

program
  .command("addnewbooks")
  .description("get the new books in calibre")
  .action(async () => {
    await library.addNewBooks();
  });

// BUG: it looks like there are some pending promises somewhere
program
  .command("lastbook")
  .description("gets the idx of the last book imported in notion")
  .action(async () => {
    const res = await library.lastBook();
    console.log(chalk.green(`Last index is ${res}`));
  });

program.parseAsync().then(() => {
  console.log("done.");
});
