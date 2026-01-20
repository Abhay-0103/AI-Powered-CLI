// Global imports
import chalk from 'chalk';
import boxen from 'boxen';
import { text, isCancel, cancel, intro, outro } from '@clack/prompts';
import yoctoSpinner from 'yocto-spinner';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

// Local imports
import { AIService } from '../ai/google.service.js';
import { ChatService } from "../../service/chat.service.js";
import { getStoredToken } from '../../lib/token.js';
import prisma from '../../lib/db.js';

marked.use(
    markedTerminal({
        // 🏴‍☠️ Luffy CLI Theme - One Piece inspired colors
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


async function initConversation(userId, conversationId = null, mode = "chat") {
    const spinner = yoctoSpinner({ text: "Loading Conversation..." }).start();

    const conversation = await chatService.getOrCreateConversation(
        userId,
        conversationId,
        mode
    )

    spinner.success("Conversation Loaded.");

    // Display conversation info
    const conversationInfo = boxen(
        `${chalk.bold("Conversation")}: ${conversation.title}\n${chalk.gray("ID: " + conversation.id)}\n${chalk.gray("Mode: " + conversation.mode)}`,
        {
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: "round",
            borderColor: "cyan",
            title: "🗨️ Chat Session",
            titleAlignment: "center",
        }
    );

    console.log(conversationInfo);

    // Display existing messages if any
    if (conversation.messages?.length > 0) {
        console.log(chalk.yellow(" 📃 Previous messages:\n"));
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
                borderColor: "blue",
                title: "👤 You",
                titleAlignment: "left",
            });
            console.log(userBox);
        } else {
            // Render mardown for assistant messages
            const renderedContent = marked.parse(msg.content);
            const assistantBox = boxen(renderedContent.trim(), {
                padding: 1,
                margin: { left: 2, bottom: 1 },
                borderStyle: "round",
                borderColor: "green",
                title: "🤖 Luffy AI Assistant",
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
        text: "Luffy AI is Thinking....",
        color: "cyan"
    }).start();

    const dbMessages = await chatService.getMessages(conversationId)
    const aiMessages = chatService.formatMessagesForAI(dbMessages)

    let fullResponse = ""

    let isFirstChunk = true;

    try {
        const result = await aiService.sendMessage(aiMessages , (chunk) => {
            if (isFirstChunk) {
                spinner.stop();
                console.log("\n");
                const header = chalk.green.bold("🤖 Luffy AI Assistant:\n");
                console.log(header);
                console.log(chalk.gray("-".repeat(60)));
                isFirstChunk = false;
            }
            fullResponse += chunk;
        }); 

        // Now Rendering the complete response in markdown
        console.log("\n");
        const renderedMarkdown = marked.parse(fullResponse);
        console.log(renderedMarkdown);
        console.log(chalk.gray("-".repeat(60)));
        console.log("\n");

        return result.content;
    } catch (error) {
        spinner.error("Failed to get AI response.");
        throw error;
    }
}

async function updateConversationTitle(conversationId, userInput, messageCount) {
    if (messageCount === 1) {
        const title = userInput.slice(0, 50) + (userInput.lenght > 50 ? "..." : "");
        await chatService.updateTitle(conversationId, title);
    }
}

async function chatLoop(conversation) {
    const helpBox = boxen(
        `${chalk.gray('• Type your message and press Enter')}\n${chalk.gray('• Markdown formatting is supported in responses')}\n${chalk.gray('• Type "exit" to end the conversation')}\n${chalk.gray('• Press Ctrl+c to quit anytime')}`,
        {
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: "round",
            borderColor: "gray",
            dimBorder: true,
        }
    );

    console.log(helpBox);

    while (true) {
        const userInput = await text({
            message: chalk.blue("Your message:"),
            placeholder: "Type your message here...",
            validate(value) {
                if (!value || value.trim().length === 0) {
                    return "Message cannot be empty.";
                }
            },
        });

        if (isCancel(userInput)) {
            const exitBox = boxen(chalk.yellow("Chat session ended. Goodbye...! 👋"), {
                padding: 1,
                margin: 1,
                borderStyle: "round",
                borderColor: "yellow",
            });
            console.log(exitBox);
            process.exit(0);
        }

        if (userInput.toLowerCase() === "exit") {
            const exitBox = boxen(chalk.yellow("Chat session ended. Goodbye...! 👋"), {
                padding: 1,
                margin: 1,
                borderStyle: "round",
                borderColor: "yellow",
            });
            console.log(exitBox);
            break;
        }

        await saveMessage(conversation.id, "user", userInput);

        const message = await chatService.getMessages(conversation.id);

        const aiResponse = await getAIResponse(conversation.id)

        await saveMessage(conversation.id, "assistant", aiResponse)

        await updateConversationTitle(conversation.id, userInput, message.length);
    }
}


export async function startChat(mode = "chat", conversationId = null) {
    try {
        intro(
            boxen(chalk.bold.cyan("Luffy AI Chat"), {
                padding: 1,
                borderStyle: "double",
                borderColor: "cyan"
            })
        )

        const user = await getUserFromToken()
        const conversation = await initConversation(user.id, conversationId, mode);
        await chatLoop(conversation)

        outro(chalk.green(" ✧˖° Thanks for chatting with Luffy AI!"))
    } catch (error) {
        const errorBox = boxen(chalk.red(`❌ ${error.message}`), {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: "red",
        });
        console.log(errorBox);
        process.exit(1);
    }
}