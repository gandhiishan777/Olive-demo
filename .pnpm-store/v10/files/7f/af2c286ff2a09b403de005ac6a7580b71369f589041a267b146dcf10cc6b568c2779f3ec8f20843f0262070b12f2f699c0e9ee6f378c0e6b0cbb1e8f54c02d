import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { AnalysisScope } from "./AnalysisScope";
import { Llm } from "./Llm";
export declare const PromptEvaluationCriteria: core.serialization.ObjectSchema<serializers.PromptEvaluationCriteria.Raw, ElevenLabs.PromptEvaluationCriteria>;
export declare namespace PromptEvaluationCriteria {
    interface Raw {
        id: string;
        name: string;
        type?: "prompt" | null;
        conversation_goal_prompt: string;
        use_knowledge_base?: boolean | null;
        scope?: AnalysisScope.Raw | null;
        llm?: Llm.Raw | null;
    }
}
