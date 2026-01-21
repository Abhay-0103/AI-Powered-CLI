// Global imports
import chalk from 'chalk';
import boxen from 'boxen';
import { text, isCancel, cancel, intro, outro, multiselect, select } from '@clack/prompts';
import yoctoSpinner from 'yocto-spinner';
import { marked, options } from 'marked';
import { markedTerminal } from 'marked-terminal';

// Local imports
import { AIService } from '../ai/google.service.js';
import { ChatService } from "../../service/chat.service.js";
import { getStoredToken } from '../../lib/token.js';
import prisma from '../../lib/db.js';
import {
    availableTools,
    getEnabledTools,
    enableTools,
    getEnabledToolNames,
    resetTools
} from "../../config/tool.config.js";
import { tool } from 'ai';


marked.use(
    markedTerminal({
        // ⚓ Luffy CLI Theme - One Piece inspired colors
        code: chalk.blue,                              // Blue like Luffy's shorts
        blockquote: chalk.yellow.italic,               // Yellow like his straw hat
        heading: chalk.red.bold,                       // Red like his vest
        firstHeading: chalk.redBright.bold.underline,  // Bright red for main heading
        hr: chalk.yellow,                              // Straw hat yellow divider
        listitem: chalk.white,                         // Clean white
        list: chalk.white,                             // Clean white
        paragraph: chalk.white,                        // Clean white text
        strong: chalk.redBright.bold,                  // Bold red for emphasis (Luffy's power!)
        em: chalk.yellow.italic,                       // Yellow italic (straw hat vibes)
        codespan: chalk.blueBright.bgBlack,            // Blue code on black
        del: chalk.gray.strikethrough,                 // Gray for deleted
        link: chalk.yellowBright.underline,            // Bright yellow links
        href: chalk.yellowBright.underline,            // Bright yellow hrefs
    })
);


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

async function selectTools() {
    const toolOptions = availableTools.map(tool => ({
        value: tool.id,
        label: tool.name,
        hint: tool.description
    }))

    const selectedTools = await multiselect({
        message: chalk.hex('#FFD700').bold("🔧 Select tools to enable (Space to select, Enter to confirm):"),
        options: toolOptions,
        required: true,
    })

    if (isCancel(selectedTools)) {
        cancel(chalk.hex('#FFA500')("⚠️ Tool Selection Cancelled. Exiting..."));
        process.exit(0);
    }

    enableTools(selectedTools);
    if (selectedTools.length === 0) {
        console.log(chalk.hex('#FFA500')("⚠️ No tools selected. Proceeding without tools."));
    } else {
        const toolsBox = boxen(
            chalk.hex('#00FF7F')(selectedTools.map(id => {
                const tool = availableTools.find(t => t.id === id);
                return ` ✓ ${chalk.white(tool.name)}`;
            }).join("\n")),
            {
                padding: 1,
                margin: { top: 1, bottom: 1 },
                borderStyle: "round",
                borderColor: "green",
                title: "⚡ Active Tools",
                titleAlignment: "center",
            }
        );
        console.log(toolsBox);
    }

    return selectTools.length > 0;
}

async function initConversation(userId, conversationId = null, mode = "Tool") {
    const spinner = yoctoSpinner({ text: "Loading Conversation..." }).start();

    const conversation = await chatService.getOrCreateConversation(
        userId,
        conversationId,
        mode
    );
    spinner.success("Conversation Loaded.");

    const enabledToolNames = getEnabledToolNames();
    const toolsDisplay = enabledToolNames.length > 0 ?
        `\n${chalk.hex('#FFD700')("⚡ Active Tools:")} ${chalk.hex('#00CED1')(enabledToolNames.join(", "))}` : `\n${chalk.dim("⚠️ No Tools Enabled")}`;

    const conversationInfo = boxen(
        `${chalk.hex('#FF6347').bold("💬 Conversation")}: ${chalk.white(conversation.title)}\n${chalk.dim("🆔 " + conversation.id)}\n${chalk.dim("⚙️ " + conversation.mode)}${toolsDisplay}`,
        {
            padding: 1,
            margin: { top: 1, bottom: 2 },
            borderStyle: "round",
            borderColor: "cyan",
            title: "🎯 Session Info",
            titleAlignment: "center",
        }
    );

    console.log(conversationInfo);

    // Display existing messages if any
    if (conversation.messages?.length > 0) {
        console.log(chalk.hex('#FFD700').bold(" 📜 Previous messages:\n"));
        displayMessages(conversation.messages);
    }

    return conversation;

}

function displayMessages(messages) {
    messages.forEach((msg) => {
        if (msg.role === "user") {
            const userBox = boxen(chalk.white(msg.content), {
                padding: 1,
                margin: { left: 2, bottom: 1 },
                borderStyle: "round",
                borderColor: "cyan",
                title: "💭 You",
                titleAlignment: "left",
            });
            console.log(userBox);
        } else {
            // Render markdown for assistant messages
            const renderedContent = marked.parse(msg.content);
            const assistantBox = boxen(renderedContent.trim(), {
                padding: 1,
                margin: { left: 2, bottom: 1 },
                borderStyle: "round",
                borderColor: "redBright",
                title: "🏴‍☠️ Luffy AI",
                titleAlignment: "left",
            });
            console.log(assistantBox);
        }
    });
}

async function saveMessage(conversationId, role, content) {
    return await chatService.addMessage(conversationId, role, content);
}

async function getAIResponse(conversationId) {
    const spinner = yoctoSpinner({
        text: "Luffy AI is thinking...",
        color: "cyan",
    }).start();

    const dbMessages = await chatService.getMessages(conversationId);
    const aiMessages = chatService.formatMessagesForAI(dbMessages);

    const tools = getEnabledTools();

    let fullResponse = "";
    let isFirstChunk = true;
    const toolCallsDetected = []

    try {
        const result = await aiService.sendMessage(
            aiMessages,
            (chunk) => {
                if (isFirstChunk) {
                    spinner.stop();
                    console.log("\n");
                    const header = chalk.green.bold(" 🏴 Luffy AI: ");
                    console.log(header);
                    console.log(chalk.gray("-".repeat(60)));
                    isFirstChunk = false;
                }

                fullResponse += chunk;
            },
            tools,
            (toolCall) => {
                toolCallsDetected.push(toolCall)
            }
        );

        if (toolCallsDetected.length > 0) {
            console.log('\n');
            const toolCallBox = boxen(
                toolCallsDetected.map(tc => `${chalk.cyan("🔧 Tool:")} ${tc.toolName}\n${chalk.gray("Args:")} ${JSON.stringify(tc.args, null, 2)}`).join("\n\n"),
                {
                    padding: 1,
                    margin: 1,
                    borderStyle: "round",
                    borderColor: "yellow",
                    title: "🔧 Tool Calls",
                }
            );
            console.log(toolCallBox);
        }

        // Display final response chunk
        if (result.toolResults && result.toolResults.length > 0) {
            const toolResultsBox = boxen(
                result.toolResults.map(tr =>
                    `${chalk.green(" Tool:")} ${tr.toolName}\n${chalk.gray("Result:")} ${JSON.stringify(tr.result, null, 2).slice(0, 200)}...`).join("\n\n"),
                {
                    padding: 1,
                    margin: 1,
                    borderStyle: "round",
                    borderColor: "green",
                    title: "🛠️ Tool Results",
                }
            );
            console.log(toolResultsBox);
        }

        // Render markdown for the final response
        const renderedMarkdown = marked.parse(fullResponse);
        const aiResponseBox = boxen(renderedMarkdown.trim(), {
            padding: 1,
            margin: { left: 2, top: 1, bottom: 2 },
            borderStyle: "round",
            borderColor: "red",
            title: "🏴‍☠️ Luffy AI",
            titleAlignment: "left",
        });
        console.log(aiResponseBox);

        return result.content;

    } catch (error) {
        spinner.error("Failed To Get AI Response");
        throw error;
    }
}

async function updateConversationTitle(conversationId, userInput, messageCount) {
    if (messageCount === 1) {
        const title = userInput.slice(0, 50) + (userInput.length > 50 ? "..." : "");
        await chatService.updateTitle(conversationId, title);
    }
}

async function chatLoop(conversation) {
    const enabledToolNames = getEnabledToolNames();
    const helpBox = boxen(
        `${chalk.hex('#00CED1')('💡 Type your message and press Enter to send.')}\n${chalk.hex('#FFD700')('🔧 AI has access to:')} ${enabledToolNames.length > 0 ? chalk.hex('#00FF7F')(enabledToolNames.join(", ")) : chalk.dim("No Tools Enabled")}\n${chalk.hex('#FFA500')('⚠️ Type "exit" to end the conversation')}\n${chalk.dim('⌨️ Press Ctrl+C to quit anytime')}`,
        {
            padding: 1,
            margin: { top: 1, bottom: 2 },
            borderStyle: "round",
            borderColor: "cyan",
            dimBorder: false,
        }
    );

    console.log(helpBox);

    while (true) {
        const userInput = await text({
            message: chalk.hex('#00CED1').bold("💬 Your message:"),
            placeholder: "Type your message here, Captain! ⚓",
            validate(value) {
                if (!value || value.trim().length === 0) {
                    return "⚠️ Message cannot be empty.";
                }
            },
        });

        if (isCancel(userInput)) {
            const exitBox = boxen(chalk.hex('#FFD700').bold("See you next adventure, Captain! 🏴‍☠️"), {
                padding: 1,
                margin: { top: 1, bottom: 1 },
                borderStyle: "round",
                borderColor: "yellow",
                title: "🌊 Farewell",
                titleAlignment: "center",
            });
            console.log(exitBox);
            process.exit(0);
        }

        if (userInput.toLowerCase() === "exit") {
            const exitBox = boxen(chalk.hex('#FFD700').bold("See you next adventure, Captain! 🏴‍☠️"), {
                padding: 1,
                margin: { top: 1, bottom: 1 },
                borderStyle: "round",
                borderColor: "yellow",
                title: "🌊 Farewell",
                titleAlignment: "center",
            });
            console.log(exitBox);
            break;
        }

        const userBox = boxen(chalk.white(userInput), {
            padding: 1,
            margin: { left: 2, top: 1, bottom: 2 },
            borderStyle: "round",
            borderColor: "cyan",
            title: "💭 You",
            titleAlignment: "left",
        });
        console.log(userBox);

        await saveMessage(conversation.id, "user", userInput);

        const message = await chatService.getMessages(conversation.id);

        const aiResponse = await getAIResponse(conversation.id)

        await saveMessage(conversation.id, "assistant", aiResponse)

        await updateConversationTitle(conversation.id, userInput, message.length);
    }
}


export async function startToolChat(conversationId = null) {

    try {
        intro(
            boxen(chalk.hex('#FF6347').bold("🏴‍☠️ Luffy AI - Tool Calling Mode"), {
                padding: 1,
                borderStyle: "round",
                borderColor: "red",
            })
        );

        const user = await getUserFromToken();

        await selectTools();

        const conversation = await initConversation(user.id, conversationId, "Tool")
        await chatLoop(conversation)

        resetTools();

        outro(chalk.hex('#00FF7F').bold("👋 Thanks for using Luffy AI Tool Chat! Goodbye!"));

    } catch (error) {
        const errorBox = boxen(chalk.hex('#FF0000').bold(`❌ Error: ${error.message}`), {
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: "round",
            borderColor: "red",
            title: "⚠️ Error",
            titleAlignment: "center",
        });
        console.log(errorBox);
        resetTools();
        process.exit(1);
    }
}