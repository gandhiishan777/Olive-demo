import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { DynamicVariableAssignment } from "./DynamicVariableAssignment";
import { DynamicVariablesConfigOutput } from "./DynamicVariablesConfigOutput";
import { PreToolSpeechMode } from "./PreToolSpeechMode";
import { ToolCallSoundBehavior } from "./ToolCallSoundBehavior";
import { ToolCallSoundType } from "./ToolCallSoundType";
import { ToolErrorHandlingMode } from "./ToolErrorHandlingMode";
import { ToolExecutionMode } from "./ToolExecutionMode";
import { WebhookToolApiSchemaConfigOutput } from "./WebhookToolApiSchemaConfigOutput";
export declare const WebhookToolConfigOutput: core.serialization.ObjectSchema<serializers.WebhookToolConfigOutput.Raw, ElevenLabs.WebhookToolConfigOutput>;
export declare namespace WebhookToolConfigOutput {
    interface Raw {
        name: string;
        description: string;
        response_timeout_secs?: number | null;
        disable_interruptions?: boolean | null;
        force_pre_tool_speech?: boolean | null;
        pre_tool_speech?: PreToolSpeechMode.Raw | null;
        assignments?: DynamicVariableAssignment.Raw[] | null;
        tool_call_sound?: ToolCallSoundType.Raw | null;
        tool_call_sound_behavior?: ToolCallSoundBehavior.Raw | null;
        tool_error_handling_mode?: ToolErrorHandlingMode.Raw | null;
        dynamic_variables?: DynamicVariablesConfigOutput.Raw | null;
        execution_mode?: ToolExecutionMode.Raw | null;
        api_schema: WebhookToolApiSchemaConfigOutput.Raw;
    }
}
