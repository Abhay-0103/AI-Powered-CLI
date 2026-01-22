// Global Imports
import chalk from 'chalk';
import { Command } from 'commander';
import yoctoSpinner from 'yocto-spinner';

// Local Imports
import { getStoredToken } from '../../../lib/token.js';
import prisma from "../../../lib/db.js";
import { select } from '@clack/prompts';
import { startChat } from '../../chat/chat-with-ai.js';
import { startToolChat } from '../../chat/chat-with-ai-tool.js';
import { startAgentChat } from '../../chat/chat-with-ai-agent.js';


const wakeUpAction = async()=> {
    const token = await getStoredToken();

    if(!token?.access_token){
        console.log(chalk.red("Not Authenticated. Please login first."));
        return;
    }

    const spinner = yoctoSpinner({text:"Fetching user infomation..."})
    spinner.start();

    const user = await prisma.user.findFirst({
        where: {
            sessions: {
                some: {
                    token:token.access_token
                }
            }
        },
        select: {

            id:true,
            name:true,
            email:true,
            image:true
        }
    });

    spinner.stop();

    if(!user){
        console.log(chalk.red("User not found. Please login again."));
        return;
    }

    console.log(chalk.greenBright(`Welcome back, ${user.name}!\n`));

    const choice = await select({
        message: "Select an Option:",
        options: [
            {
                value: "chat",
                label: "chat",
                hint: "Start a chat with AI",
            },
            {
                value: "tool",
                label: "Tool Calling",
                hint: "Chat with Tools (Google search, code execution, etc.)",
            },
            {
                value: "agent",
                label: "Agentic Mode",
                hint: "Advanced AI agent (Coming Soon!)",
            },
        ],
    })

    switch(choice){
        case "chat":
           await startChat("chat");
            break;
        case "tool":
           await startToolChat();
            break;
        case "agent":
            await startAgentChat();
            break;
    }

}


export const wakeUp = new Command("wakeup")
    .description("Wake up the AI and choose interaction mode")
    .action(wakeUpAction);