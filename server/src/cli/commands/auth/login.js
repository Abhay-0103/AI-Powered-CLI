// Global imports
import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs/promises";
import open from "open";
import os from "os";
import path from "path";
import yoctoSpinner from "yocto-spinner";
import * as z from "zod/v4";
import dotenv from "dotenv";

// Local imports
import prisma from "../../../lib/db.js";
import { getStoredToken, isTokenExpired, storeToken } from "../../../lib/token.js";



dotenv.config();

const URL = "http://localhost:3005";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;

// =======================
export const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
export const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");


// =======================
// TOKEN MANAGEMENT UTILITIES (Export these for use other commands)
// =======================

export async function loginAction(opts) {
    const options = z.object({
        serverUrl: z.string().optional(),
        clientId: z.string().optional()
    })

    const serverUrl = options.serverUrl || URL;
    const clientId = options.clientId || CLIENT_ID;

    intro(chalk.cyan("🔐 Secure login for Luffy CLI"));

    // TODO: CHANGE THIS WITH TOKEN MANAGEMENT UTILITY
    const existingToken = await getStoredToken();
    const expired = await isTokenExpired();

    if (existingToken && !expired) {
        const shouldReAuth = await confirm({
            message: "You are already logged in. Do you want to re-login?",
            initialValue: false
        })

        if (isCancel(shouldReAuth) || !shouldReAuth) {
            cancel("Login cancelled.");
            process.exit(0);
        }
    }
    const authClient = createAuthClient({
        baseURL: serverUrl,
        plugins: [deviceAuthorizationClient()]
    })

    const spinner = yoctoSpinner({ text: "Requesting device authorization..." });
    spinner.start();

    try {
        const { data, error } = await authClient.device.code({
            client_id: clientId,
            scope: "openid profile email"
        })
        spinner.stop();

        if (error || !data) {
            logger.error(
                `Failed to request device authorization: ${error.error_description}`
            )

            process.exit(1);
        }

        const {
            device_code,
            user_code,
            verification_uri,
            verification_uri_complete,
            interval = 5,
            expires_in
        } = data;

        console.log(chalk.cyan("Device Authorization Requested!"));

        console.log(`Please visit: ${chalk.underline.blue(verification_uri || verification_uri_complete)}`);

        console.log(`Enter Code: ${chalk.bold.green(user_code)}`);

        const shouldOpen = await confirm({
            message: "Open Browser Automatically",
            initialValue: true
        })

        if (!isCancel(shouldOpen) && shouldOpen) {
            const urlToOpen = verification_uri_complete || verification_uri;
            await open(urlToOpen);
        }

        console.log(
            chalk.gray(
                `Waiting for authorization... (expires in ${Math.floor(expires_in / 60)} minutes)`
            )
        );

        const token = await pollForToken(
            authClient,
            device_code,
            clientId,
            interval
        );

        if (token) {
            const saved = await storeToken(token)

            if (!saved) {
                console.log(
                    chalk.yellow("\n⚠️  Warning: Could not save authentication token.")
                );
                console.log(
                    chalk.yellow( "You may need to login on next use.")
                );
            }

            // todo: get the user data
            outro(chalk.green("✅ Successfully logged in!"));

            console.log(chalk.gray(`\n Token saved to: ${TOKEN_FILE}`));

            console.log(
                chalk.gray("\n You can now use Luffy CLI without logging in again.")
            );
        }
    } catch (error) {
        spinner.stop();
        console.error(chalk.red("Login failed:"), error.message);
        process.exit(1);
    }
}


async function pollForToken(authClient, deviceCode, clientId, initialIntervalue) {
    let pollingInterval = initialIntervalue;
    const spinner = yoctoSpinner({ text: "", color: "cyan" });
    let dots = 0;

    return new Promise((resolve, reject) => {
        const poll = async () => {
            dots = (dots + 1) % 4;
            spinner.text = chalk.gray(
                `polling for authorization${".".repeat(dots)}${" ".repeat(3 - dots)}`
            );
            if (!spinner.isSpinning) spinner.start();

            try {
                const { data, error } = await authClient.device.token({
                    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                    device_code: deviceCode,
                    client_id: clientId,
                    fetchOptions: {
                        headers: {
                            "user-agent": `luffy-cli`,
                        }
                    },
                });

                if (data?.access_token) {
                    console.log(
                        chalk.bold.green(`Your access token is: ${data.access_token}`)
                    );

                    spinner.stop();
                    resolve(data);
                    return;
                }
                else if (error) {
                    switch (error.error) {
                        case "authorization_pending":
                            // Continue polling
                            break;
                        case "slow_down":
                            pollingInterval += 5;
                            break;
                        case "access_denied":
                            console.error("Access was denied by the user");
                            return;
                        case "expired_token":
                            console.error("The device code has expired. Please try again.");
                            return;
                        default:
                            spinner.stop();
                            logger.error(`Error: ${error.error_description}`);
                            process.exit(1);
                    }
                }

            } catch (error) {
                spinner.stop();
                logger.error(`Network error: ${error.message}`);
                process.exit(1);
            }

            setTimeout(poll, pollingInterval * 1000); // Convert to 1 milliseconds
        };

        setTimeout(poll, pollingInterval * 1000); // Initial delay
    });
};

// =======================
// CLI COMMAND SETUP
// =======================


export const login = new Command("login")
    .description("Login to Luffy CLI")
    .option("--server-url <url>", "Authentication server URL", URL)
    .option("--client-id <id>", "OAuth Client ID", CLIENT_ID)
    .action(loginAction);