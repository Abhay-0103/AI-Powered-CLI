#!/usr/bin/env node

// Global Imports
import dotenv from 'dotenv';
import chalk from 'chalk';
import figlet from 'figlet';

import { Command } from 'commander';

// Local Imports
import { login } from './commands/auth/login.js';

dotenv.config();


async function main() {
    // Display Banner
    console.log(
        chalk.redBright(
            figlet.textSync("Luffy CLI", {
                font: "Standard",
                horizontalLayout: "default",
            })
        )
    )

    console.log(chalk.yellowBright("Welcome to Luffy CLI — an AI-powered pirate tool 🏴‍☠️"));

    const program = new Command("Luffy");

   program
  .version("1.0.0")
  .description(
    "🏴‍☠️  A pirate-themed AI-powered CLI inspired by One Piece — set sail, automate tasks, and conquer the Grand Line of code."
  )
  .addCommand(login)

    // Default action shows help
    program.action(() => {
        program.help();
    });

    program.parse();
}

main().catch((err) => {
    console.error(chalk.red("Error running Luffy CLI:"), err);
    process.exit(1);
})