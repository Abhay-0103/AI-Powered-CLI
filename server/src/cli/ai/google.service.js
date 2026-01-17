// Global Imports
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import chalk from "chalk";

// Local Imports
import { config } from "../../config/google.config.js";

export class AIService {
    constructor() {
        if (!config.googleApiKey) {
            throw new Error(chalk.red("Google API key is not set. Please set the GOOGLE_API_KEY env."));
        }

        this.model = google(config.model, {
            apiKey: config.googleApiKey,
        })
    }


    /**
     * Send a message and get streaming response
     * @param {Array} messages
     * @param {Function} onChunk
     * @param {Object} tools
     * @param {Function} onToolCall
     * @returns {Promise<Object>}

     */

    async sendMessage(messages, onChunk, tools = undefined, onToolCall = null) {
        try {
            const streamConfig = {
                model: this.model,
                messages: messages,

            }

            const result = streamText(StreamConfig);

            let fullResponse = "";

            for await (const chunk of result.textStream) {
                fullResponse += chunk;
                if (onChunk) {
                    onChunk(chunk);
                }
            }

            const fullResult = result;

            return {
                content: fullResponse,
                finishResponse: fullResult.finishReason,
                usage: fullResult.usage
            }
        } catch (error) {
            console.error(chalk.red("AI Service Error:"), error.messages);
            throw error;
        }
    }

    /**
     * Get a non-streaming response
     * @param {Array} messages - Array of message objects
     * @param {Object} tools - Optional tools for the AI to use
     * @returns {Promise<string>} Response text
     */

    async getMessage(messages, tools = undefined) {
        let fullResponse = "";
        await this.sendMessage(messages, (chunk) => {
            fullResponse += chunk;
        });

        return fullResponse;
    }
}