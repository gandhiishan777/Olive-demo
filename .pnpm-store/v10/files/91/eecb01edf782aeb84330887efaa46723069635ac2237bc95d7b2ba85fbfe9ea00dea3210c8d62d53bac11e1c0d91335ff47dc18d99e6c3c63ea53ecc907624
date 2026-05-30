import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { DynamicVariablesConfigOutput } from "./DynamicVariablesConfigOutput";
import { PromptAgentApiModelOutput } from "./PromptAgentApiModelOutput";
export declare const AgentConfig: core.serialization.ObjectSchema<serializers.AgentConfig.Raw, ElevenLabs.AgentConfig>;
export declare namespace AgentConfig {
    interface Raw {
        first_message?: string | null;
        language?: string | null;
        hinglish_mode?: boolean | null;
        dynamic_variables?: DynamicVariablesConfigOutput.Raw | null;
        disable_first_message_interruptions?: boolean | null;
        max_conversation_duration_message?: string | null;
        prompt?: PromptAgentApiModelOutput.Raw | null;
    }
}
