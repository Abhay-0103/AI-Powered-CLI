// Global Imports
import chalk from 'chalk';
import boxen from 'boxen';
import yoctoSpinner from 'yocto-spinner';
import { text, isCancel, cancel, intro, outro, multiselect, select, confirm } from '@clack/prompts';

// Local Imports
import { AIService } from '../ai/google.service.js';
import { ChatService } from "../../service/chat.service.js";
import { getStoredToken } from '../../lib/token.js';
import prisma from '../../lib/db.js';
import { generateApplication } from '../../config/agent.config.js';


const aiService = new AIService();
const chatService = new ChatService();

async function getUserFromToken() {
    const token = await getStoredToken();
    if (!token?.access_token) {
        throw new Error("Not Authenticated. Please run 'luffy login' first.");
    }
    const spinner = yoctoSpinner({ text: "Authenticating..." }).start();
    const user = await prisma.user.findFirst({
        where: {
            sessions: {
                some: {
                    token: token.access_token
                },
            },
        },
    });

    if (!user) {
        spinner.error("User not Found");
        throw new Error("User not Found. Please login again.");
    }
    spinner.success(`Welcome back, ${user.name}!`);
    return user;
}

async function initConversation(userId, conversationId = null) {
    const conversation = await chatService.getOrCreateConversation(
        userId,
        conversationId,
        "agent"
    );

    const conversationInfo = boxen(
        chalk.yellowBright.bold("⚓ Voyage Log ⚓") + '\n\n' +
        chalk.cyanBright("Mission: ") + chalk.white(conversation.title) + '\n' +
        chalk.gray("Log ID: ") + chalk.white(conversation.id) + '\n' +
        chalk.gray("Mode: ") + chalk.magentaBright.bold("Agent (Straw Hat Builder)") + '\n' +
        chalk.cyanBright("Ship's Location: ") + chalk.white(process.cwd()),
        {
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: "bold",
            borderColor: "cyanBright",
            title: chalk.cyanBright.bold(" ⚓ Captain's Log ⚓ "),
            titleAlignment: "center",
        }
    );

    console.log(conversationInfo);

    return conversation;
}

async function saveMessage(conversationId, role, content) {
    return await chatService.addMessage(conversationId, role, content);
}

async function agentLoop(conversation) {
    const helpBox = boxen(
        chalk.yellowBright.bold("⚓ What can your AI Nakama do? ⚓") + '\n\n' +
        chalk.greenBright('✔') + ' ' + chalk.white('Generate complete applications from descriptions') + '\n' +
        chalk.greenBright('✔') + ' ' + chalk.white('Create all necessary files and folders') + '\n' +
        chalk.greenBright('✔') + ' ' + chalk.white('Include setup instructions and commands') + '\n' +
        chalk.greenBright('✔') + ' ' + chalk.white('Generate production-ready code') + '\n\n' +
        chalk.cyanBright.bold("💡 Example Adventures:") + '\n' +
        chalk.gray('  → ') + chalk.white('"Build a todo app with React and Tailwind"') + '\n' +
        chalk.gray('  → ') + chalk.white('"Create a REST API with Express and MongoDB"') + '\n' +
        chalk.gray('  → ') + chalk.white('"Make a weather app using OpenWeatherMap API"') + '\n\n' +
        chalk.gray.italic('Type "exit" to return to the ship'),
        {
            padding: 1,
            margin: { bottom: 1 },
            borderStyle: "bold",
            borderColor: "greenBright",
            title: chalk.greenBright.bold(" ⚓ Agent Mode - Straw Hat Builder ⚓ "),
            titleAlignment: "center"
        }
    );

    console.log(helpBox);

    while (true) {
        const userInput = await text({
            message: chalk.yellow("⚓ What shall we build, Captain?"),
            placeholder: "Describe your dream application...",
            validate(value) {
                if (!value || value.trim().length === 0) {
                    return "Description cannot be empty";
                }
                if (value.trim().length < 10) {
                    return "Please provide more details (at least 10 characters)";
                }
            },
        });

        if (isCancel(userInput)) {
            console.log(chalk.yellow("\n⚓ Anchors away! Heading back to port...\n"));
            process.exit(0);
        }

        if (userInput.toLowerCase() === "exit") {
            console.log(chalk.yellow("\n⚓ Fair winds, Captain! Until next voyage! ⚓\n"));
            break;
        }

        const userBox = boxen(chalk.white(userInput), {
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: "double",
            borderColor: "cyan",
            title: "⚓ Captain's Orders",
            titleAlignment: "left",
        });
        console.log(userBox);

        await saveMessage(conversation.id, "user", userInput);

        try {
            const result = await generateApplication(
                userInput,
                aiService,
                process.cwd()
            )

            if (result && result.success) {
                // Save successful generation details
                const responseMessage = `Generated application: ${result.folderName}\n` +
                    `Files created: ${result.files.length}\n` +
                    `Location: ${result.appDir}\n\n` +
                    `Setup commands:\n${result.commands.join('\n')}`;

                await saveMessage(conversation.id, "assistant", responseMessage);

                // Ask if user wants to generate another app
                const continuePrompt = await confirm({
                    message: chalk.yellow("⚓ Ready for another adventure, Captain?"),
                    initialValue: false,
                });
                if (isCancel(continuePrompt) || !continuePrompt) {
                    console.log(chalk.yellow("\n⚓ Excellent work! Your treasure awaits in the folder! ⚓\n"));
                    break;
                }


            } else {
                throw new Error("Application generation failed.");
            }

        } catch (error) {
            console.log(chalk.red(`\n⚓ Storm ahead! ${error.message}\n`));

            await saveMessage(conversation.id, "assistant", `Error: ${error.message}`);

            const retry = await confirm({
                message: chalk.yellow("⚓ Shall we try again, Captain?"),
                initialValue: true,
            });

            if (isCancel(retry) || !retry) {
                break;
            }
        }
    }
}


export async function startAgentChat(conversationId = null) {
    try {
        intro(
            boxen(
                chalk.magentaBright.bold('✨ AGENT MODE ACTIVATED ✨') + '\n\n' +
                chalk.whiteBright.bold('⚓ Straw Hat App Builder ⚓') + '\n\n' +
                chalk.gray.italic('"I\'m gonna be the King of the Code!" - Luffy'),
                {
                    padding: 1,
                    borderStyle: "bold",
                    borderColor: "magentaBright",
                    textAlignment: "center"
                }
            )
        );

        const user = await getUserFromToken();

        // Warning about File System Access
        const shouldContinue = await confirm({
            message: chalk.yellowBright("⚓ The agent will create files in your current directory. Ready to set sail?"),
            initialValue: true,
        });

        if (isCancel(shouldContinue) || !shouldContinue) {
            cancel(chalk.yellowBright("⚓ Returning to the ship..."));
            process.exit(0);
        }

        const conversation = await initConversation(user.id, conversationId);
        await agentLoop(conversation);

        outro(chalk.greenBright.bold('✨ Until next time, Captain! May the winds guide you! ✨'));

    } catch (error) {
        const errorBox = boxen(chalk.redBright.bold(`❌ Error: ${error.message}`), {
            padding: 1,
            margin: 1,
            borderStyle: "bold",
            borderColor: "redBright",
        });
        console.log(errorBox);
        process.exit(1);
    }
}