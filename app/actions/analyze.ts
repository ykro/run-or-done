'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Storage } from "@google-cloud/storage";
import { Firestore, FieldValue } from "@google-cloud/firestore";
import { ForensicAnalysisSchema } from "@/lib/schemas";
import { getSystemPrompt } from "@/lib/prompt-loader";
// import { v4 as uuidv4 } from 'uuid'; // native crypto.randomUUID used instead

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Initialize GCP Clients
// Note: These will use GOOGLE_APPLICATION_CREDENTIALS from env automatically if keyFilename is omitted,
// but checking if env vars are set ensures we don't crash if they are missing (handled gracefully)
const projectId = process.env.GCP_PROJECT_ID;
const bucketName = process.env.GCS_BUCKET_NAME;

const storage = new Storage({
    projectId: projectId,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const firestore = new Firestore({
    projectId: projectId,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    databaseId: process.env.FIRESTORE_DATABASE_ID,
});

export async function analyzeShoes(formData: FormData) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-3-pro-preview",
            generationConfig: { responseMimeType: "application/json" }
        });

        const systemPrompt = await getSystemPrompt();
        const analysisId = crypto.randomUUID(); // Unique ID for this analysis run

        console.log(`Starting Analysis [${analysisId}]`);

        const views = ["OUTSOLE", "LATERAL", "MEDIAL", "HEEL", "TOP"];
        const presentViews: string[] = [];
        const missingViews: string[] = [];
        const imageParts: any[] = [];
        const uploadedImageUrls: Record<string, string> = {};

        const bucket = bucketName ? storage.bucket(bucketName) : null;

        for (const view of views) {
            const file = formData.get(view) as File | null;
            if (file && file.size > 0) {
                presentViews.push(view);
                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                // 1. Prepare for Gemini (Inline Bytes - fastest for GenAI)
                imageParts.push({
                    inlineData: {
                        data: buffer.toString("base64"),
                        mimeType: file.type,
                    },
                });

                // 2. Upload to GCS (Async, don't block Gemini prep too much, but wait for it to ensure persistence)
                if (bucket) {
                    try {
                        const extension = file.type.split('/')[1] || 'jpg';
                        const gcsPath = `uploads/${analysisId}/${view}.${extension}`;
                        const fileRef = bucket.file(gcsPath);

                        await fileRef.save(buffer, {
                            metadata: { contentType: file.type }
                        });

                        // Construct public or gs URI (We'll store gs URI for internal ref, or https if public)
                        // Using gs:// is cleaner for internal backend usage
                        uploadedImageUrls[view] = `gs://${bucketName}/${gcsPath}`;
                        console.log(`Uploaded ${view} to ${gcsPath}`);
                    } catch (uploadError) {
                        console.error(`Failed to upload ${view} to GCS:`, uploadError);
                        // Continue analysis even if upload fails? Yes, prioritizing user result.
                    }
                }

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

        // --- GEMINI ANALYSIS ---
        while (attempt < MAX_RETRIES) {
            try {
                result = await model.generateContent([
                    systemPrompt,
                    contextMessage,
                    ...imageParts
                ]);
                break;
            } catch (error: any) {
                attempt++;
                console.error(`Attempt ${attempt} failed:`, error);
                const isRetryable = error.message?.includes('503') || error.message?.includes('429');
                if (isRetryable && attempt < MAX_RETRIES) {
                    const delay = 1000 * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }

        if (!result) {
            throw new Error("Failed to generate content after retries.");
        }

        const responseText = result.response.text();
        console.log("Gemini Response:", responseText);

        try {
            const parsed = ForensicAnalysisSchema.parse(JSON.parse(responseText));

            // --- SAVE TO FIRESTORE ---
            try {
                const reportData = {
                    analysisId: analysisId,
                    createdAt: FieldValue.serverTimestamp(),
                    shoe_model: parsed.shoe_info.detected_brand_model,
                    verdict_status: parsed.verdict.status_code,
                    final_prescription: parsed.verdict.final_prescription,
                    images: uploadedImageUrls,
                    full_analysis: parsed, // Store complete JSON
                    audit: {
                        present_views: presentViews,
                        missing_views: missingViews,
                        model_version: "gemini-3-pro-preview"
                    }
                };

                await firestore.collection('reports').doc(analysisId).set(reportData);
                console.log(`Report saved to Firestore: reports/${analysisId}`);

            } catch (dbError) {
                console.error("Failed to save report to Firestore:", dbError);
                // Don't fail the request, users just want the result
            }

            return { success: true, data: parsed };
        } catch (parseError) {
            console.error("Validation Error:", parseError);
            return { success: false, error: "Analysis result validation failed." };
        }

    } catch (error: any) {
        console.error("Analysis failed:", error);
        let errorMessage = "Analysis failed. Please check API key and try again.";
        if (error.message?.includes('503')) {
            errorMessage = "Service temporarily unavailable. Please try again later.";
        } else if (error.message?.includes('429')) {
            errorMessage = "Too many requests. Please wait a moment.";
        }
        return { success: false, error: errorMessage };
    }
}
