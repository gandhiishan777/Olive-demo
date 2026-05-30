import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { ConversationHistoryTranscriptCommonModelOutput } from "./ConversationHistoryTranscriptCommonModelOutput";
import { DynamicVariableValueTypeOutput } from "./DynamicVariableValueTypeOutput";
import { TestFromConversationMetadataOutput } from "./TestFromConversationMetadataOutput";
import { UnitTestToolCallEvaluationModelOutput } from "./UnitTestToolCallEvaluationModelOutput";
export declare const GetToolCallUnitTestResponseModel: core.serialization.ObjectSchema<serializers.GetToolCallUnitTestResponseModel.Raw, ElevenLabs.GetToolCallUnitTestResponseModel>;
export declare namespace GetToolCallUnitTestResponseModel {
    interface Raw {
        from_conversation_metadata?: TestFromConversationMetadataOutput.Raw | null;
        dynamic_variables?: Record<string, DynamicVariableValueTypeOutput.Raw | null | undefined> | null;
        chat_history?: ConversationHistoryTranscriptCommonModelOutput.Raw[] | null;
        tool_call_parameters?: UnitTestToolCallEvaluationModelOutput.Raw | null;
        check_any_tool_matches?: boolean | null;
        id: string;
        name: string;
    }
}
