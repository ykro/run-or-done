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

        const result = await model.generateContent([
            systemPrompt,
            contextMessage,
            ...imageParts
        ]);

        const responseText = result.response.text();
        console.log("Gemini Response:", responseText); // Debugging

        try {
            const parsed = ForensicAnalysisSchema.parse(JSON.parse(responseText));
            return { success: true, data: parsed };
        } catch (parseError) {
            console.error("Validation Error:", parseError);
            return { success: false, error: "Analysis result validation failed." };
        }

    } catch (error) {
        console.error("Analysis failed:", error);
        return { success: false, error: "Analysis failed. Please check API key and try again." };
    }
}
