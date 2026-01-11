import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { clearStoredToken, getStoredToken } from "../../../lib/token.js";

export async function logoutAction() {
    intro(chalk.bold(" 👋 Logging out of Luffy CLI"));

    const token = await getStoredToken();

    if (!token) {
        console.log(chalk.yellow("⚠️  You are not logged in."));
        process.exit(1);
    }

    const shouldLogout = await confirm({
        message: "Are you sure you want to logout?",
        initialValue: false,
    });

    if (isCancel(shouldLogout) || !shouldLogout) {
        cancel("Logout cancelled.");
        process.exit(0);
    }

    const cleared = await clearStoredToken();

    if (cleared) {
        outro(chalk.green("✅ Successfully logged out of Luffy CLI."));
    } else {
        console.log(chalk.red("⚠️ Could not clear token file."));
        process.exit(1);
    }
}


export const logout = new Command("logout")
    .description("Logout from Luffy CLI")
    .action(logoutAction);