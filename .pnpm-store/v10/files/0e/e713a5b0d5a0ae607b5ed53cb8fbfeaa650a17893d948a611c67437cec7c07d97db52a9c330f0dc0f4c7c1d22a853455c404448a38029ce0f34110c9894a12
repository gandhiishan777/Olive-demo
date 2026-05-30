import type * as ElevenLabs from "../../../../../../../../../api/index";
import * as core from "../../../../../../../../../core";
import type * as serializers from "../../../../../../../../index";
import { DynamicVariableAssignment } from "../../../../../../../../types/DynamicVariableAssignment";
import { PreToolSpeechMode } from "../../../../../../../../types/PreToolSpeechMode";
import { ToolCallSoundBehavior } from "../../../../../../../../types/ToolCallSoundBehavior";
import { ToolCallSoundType } from "../../../../../../../../types/ToolCallSoundType";
import { ToolExecutionMode } from "../../../../../../../../types/ToolExecutionMode";
import { ToolResponseMockConfigInput } from "../../../../../../../../types/ToolResponseMockConfigInput";
import { McpToolConfigOverrideUpdateRequestModelInputOverridesValue } from "../../types/McpToolConfigOverrideUpdateRequestModelInputOverridesValue";
export declare const McpToolConfigOverrideUpdateRequestModel: core.serialization.Schema<serializers.conversationalAi.mcpServers.McpToolConfigOverrideUpdateRequestModel.Raw, ElevenLabs.conversationalAi.mcpServers.McpToolConfigOverrideUpdateRequestModel>;
export declare namespace McpToolConfigOverrideUpdateRequestModel {
    interface Raw {
        force_pre_tool_speech?: boolean | null;
        pre_tool_speech?: PreToolSpeechMode.Raw | null;
        disable_interruptions?: boolean | null;
        tool_call_sound?: ToolCallSoundType.Raw | null;
        tool_call_sound_behavior?: ToolCallSoundBehavior.Raw | null;
        execution_mode?: ToolExecutionMode.Raw | null;
        response_timeout_secs?: number | null;
        assignments?: DynamicVariableAssignment.Raw[] | null;
        input_overrides?: Record<string, McpToolConfigOverrideUpdateRequestModelInputOverridesValue.Raw | null | undefined> | null;
        response_mocks?: ToolResponseMockConfigInput.Raw[] | null;
    }
}
