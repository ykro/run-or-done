import fs from 'fs/promises';
import path from 'path';

let cachedPrompt: string | null = null;

export async function getSystemPrompt(): Promise<string> {
    if (cachedPrompt) {
        return cachedPrompt;
    }

    try {
        const promptPath = path.join(process.cwd(), 'analysis.md');
        cachedPrompt = await fs.readFile(promptPath, 'utf-8');
        return cachedPrompt;
    } catch (error) {
        console.error("Failed to load analysis.md:", error);
        throw new Error("System prompt could not be loaded.");
    }
}
