import type * as ElevenLabs from "../../../../../../../api/index";
import * as core from "../../../../../../../core";
import type * as serializers from "../../../../../../index";
import { ConvAiSecretLocator } from "../../../../../../types/ConvAiSecretLocator";
import { McpApprovalPolicy } from "../../../../../../types/McpApprovalPolicy";
import { PreToolSpeechMode } from "../../../../../../types/PreToolSpeechMode";
import { ToolCallSoundBehavior } from "../../../../../../types/ToolCallSoundBehavior";
import { ToolCallSoundType } from "../../../../../../types/ToolCallSoundType";
import { ToolExecutionMode } from "../../../../../../types/ToolExecutionMode";
import { McpServerConfigUpdateRequestModelAuthConnection } from "../../types/McpServerConfigUpdateRequestModelAuthConnection";
import { McpServerConfigUpdateRequestModelRequestHeadersValue } from "../../types/McpServerConfigUpdateRequestModelRequestHeadersValue";
export declare const McpServerConfigUpdateRequestModel: core.serialization.Schema<serializers.conversationalAi.McpServerConfigUpdateRequestModel.Raw, ElevenLabs.conversationalAi.McpServerConfigUpdateRequestModel>;
export declare namespace McpServerConfigUpdateRequestModel {
    interface Raw {
        approval_policy?: McpApprovalPolicy.Raw | null;
        force_pre_tool_speech?: boolean | null;
        pre_tool_speech?: PreToolSpeechMode.Raw | null;
        disable_interruptions?: boolean | null;
        tool_call_sound?: ToolCallSoundType.Raw | null;
        tool_call_sound_behavior?: ToolCallSoundBehavior.Raw | null;
        execution_mode?: ToolExecutionMode.Raw | null;
        response_timeout_secs?: number | null;
        request_headers?: Record<string, McpServerConfigUpdateRequestModelRequestHeadersValue.Raw | null | undefined> | null;
        disable_compression?: boolean | null;
        secret_token?: ConvAiSecretLocator.Raw | null;
        auth_connection?: McpServerConfigUpdateRequestModelAuthConnection.Raw | null;
    }
}
