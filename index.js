#!/usr/bin/env node

import chalk from "chalk";
import { Command } from 'commander';
import { lastBook, newBooks, newAuthors } from "./lib/library.js";
import "dotenv/config"

const program = new Command();

program
  .name("mynot")
  .description("My Notion CLI applications")
  .version()


program
  .command("library")
  .description(
    "fetches books and authors, puts it where they belong, in Notion. Yeah! :)"
  )
  .option('--all', 'get all new books from calibre')
  .action(() => {
    library()
  });

  program
  .command("newbooks")
  .description(
    "get the new books from calibre"
  )
  .action(async () => {
    const res = await newBooks()
    console.log(res);
    // console.log(res[0].authors);
  });

  program
  .command("newauthors")
  .description(
    "get the new authors from calibre"
  )
  .action(async () => {
    const res = await newAuthors()
    console.log(res);
  });

  program
  .command("lastbook")
  .description(
    "gets the idx of the last book imported in notion"
  )
  .action(async () => {
    const res = await lastBook()
    console.log(res);
  });

program
  .command("highlights")
  .description("fetches Calibre highlights, puts them in Notion, yeah")
  .action(() => {
    library.getAllHighlights().catch((e) => {
      console.log("\n\nerror: " + e.message);
      process.exit(0);
    });
  });

program.parse();

