import { z } from "zod";

export const ShoeCategoryEnum = z.enum(["ROAD", "TRAIL", "HYBRID", "UNKNOWN"]);
export const StatusColorEnum = z.enum(["GREEN", "YELLOW", "RED", "GRAY"]);
export const StrikePatternEnum = z.enum(["HEEL", "MIDFOOT", "FOREFOOT", "UNDETERMINED"]);
export const PronationEnum = z.enum(["NEUTRAL", "OVERPRONATION", "SUPINATION", "UNDETERMINED"]);
// Syncs with analysis.md "Possible inputs"
export const ViewEnum = z.enum(["OUTSOLE", "LATERAL", "MEDIAL", "HEEL", "TOP"]);

export const ForensicAnalysisSchema = z.object({
    analysis_audit: z.object({
        is_complete_scan: z.boolean(),
        received_views: z.array(ViewEnum),
        missing_views: z.array(ViewEnum),
        limitations_summary: z.string().describe("Explanation of limitations due to missing data"),
    }),
    shoe_info: z.object({
        detected_brand_model: z.string().nullable(),
        category: ShoeCategoryEnum,
        confidence_score: z.number().min(0).max(100),
    }),
    component_health: z.object({
        outsole: z.object({
            condition_score: z.number().min(0).max(100),
            wear_pattern: z.enum(["HEEL_STRIKE", "MIDFOOT", "FOREFOOT", "UNEVEN", "UNKNOWN"]),
            technical_observation: z.string(),
        }),
        midsole: z.object({
            life_remaining_percentage: z.number().min(0).max(100),
            compression_status: z.enum(["HEALTHY", "SURFACE_WRINKLES", "DEEP_COMPRESSION", "COLLAPSED", "UNKNOWN"]),
            medial_vs_lateral_variance: z.enum(["BALANCED", "MEDIAL_COLLAPSE", "LATERAL_COLLAPSE", "UNKNOWN"]),
            technical_observation: z.string(),
        }),
        upper: z.object({
            status: z.enum(["GOOD", "TEARS_DETECTED", "HOLES_DETECTED", "UNKNOWN"]),
            observation: z.string(),
        }),
    }),
    biomechanics: z.object({
        foot_strike_detected: StrikePatternEnum,
        pronation_assessment: PronationEnum,
        injury_risk_factors: z.array(z.string()),
    }),
    verdict: z.object({
        status_code: StatusColorEnum,
        display_title: z.string(),
        estimated_km_left: z.string(),
        final_prescription: z.string(),
    }),
});

export type ForensicAnalysis = z.infer<typeof ForensicAnalysisSchema>;
