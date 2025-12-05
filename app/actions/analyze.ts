'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { ForensicAnalysisSchema } from "@/lib/schemas";
import { getSystemPrompt } from "@/lib/prompt-loader";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function analyzeShoes(formData: FormData) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-3-pro-preview",
            generationConfig: { responseMimeType: "application/json" }
        });

        const systemPrompt = await getSystemPrompt();

        const views = ["OUTSOLE", "LATERAL", "MEDIAL", "HEEL", "TOP"];
        const presentViews: string[] = [];
        const missingViews: string[] = [];
        const imageParts: any[] = [];

        for (const view of views) {
            const file = formData.get(view) as File | null;
            if (file && file.size > 0) {
                presentViews.push(view);
                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                imageParts.push({
                    inlineData: {
                        data: buffer.toString("base64"),
                        mimeType: file.type,
                    },
                });
            } else {
                missingViews.push(view);
            }
        }

        const contextMessage = `
      Context Injection:
      Views present: ${presentViews.join(", ")}
      Missing views: ${missingViews.join(", ")}
    `;

        const MAX_RETRIES = 3;
        let attempt = 0;
        let result = null;

        while (attempt < MAX_RETRIES) {
            try {
                result = await model.generateContent([
                    systemPrompt,
                    contextMessage,
                    ...imageParts
                ]);
                break; // Success, exit loop
            } catch (error: any) {
                attempt++;
                console.error(`Attempt ${attempt} failed:`, error);

                const isRetryable = error.message?.includes('503') || error.message?.includes('429');

                if (isRetryable && attempt < MAX_RETRIES) {
                    const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // If not retryable or max retries reached, throw to outer catch
                throw error;
            }
        }

        if (!result) {
            throw new Error("Failed to generate content after retries.");
        }

        const responseText = result.response.text();
        console.log("Gemini Response:", responseText); // Debugging

        try {
            const parsed = ForensicAnalysisSchema.parse(JSON.parse(responseText));
            return { success: true, data: parsed };
        } catch (parseError) {
            console.error("Validation Error:", parseError);
            return { success: false, error: "Analysis result validation failed." };
        }

    } catch (error: any) {
        console.error("Analysis failed:", error);

        let errorMessage = "Analysis failed. Please check API key and try again.";
        if (error.message?.includes('503')) {
            errorMessage = "Service temporarily unavailable (503). retried 3 times. Please try again later.";
        } else if (error.message?.includes('429')) {
            errorMessage = "Too many requests (429). Please wait a moment and try again.";
        }

        return { success: false, error: errorMessage };
    }
}
