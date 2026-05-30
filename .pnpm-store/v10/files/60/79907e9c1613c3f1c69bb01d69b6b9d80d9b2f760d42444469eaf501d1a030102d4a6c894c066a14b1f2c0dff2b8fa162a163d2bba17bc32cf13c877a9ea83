import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { ConversationHistoryTranscriptCommonModelInput } from "./ConversationHistoryTranscriptCommonModelInput";
import { DynamicVariableValueTypeInput } from "./DynamicVariableValueTypeInput";
import { TestFromConversationMetadataInput } from "./TestFromConversationMetadataInput";
import { UnitTestToolCallEvaluationModelInput } from "./UnitTestToolCallEvaluationModelInput";
export declare const UpdateToolCallUnitTestRequest: core.serialization.ObjectSchema<serializers.UpdateToolCallUnitTestRequest.Raw, ElevenLabs.UpdateToolCallUnitTestRequest>;
export declare namespace UpdateToolCallUnitTestRequest {
    interface Raw {
        from_conversation_metadata?: TestFromConversationMetadataInput.Raw | null;
        dynamic_variables?: Record<string, DynamicVariableValueTypeInput.Raw | null | undefined> | null;
        chat_history?: ConversationHistoryTranscriptCommonModelInput.Raw[] | null;
        tool_call_parameters?: UnitTestToolCallEvaluationModelInput.Raw | null;
        check_any_tool_matches?: boolean | null;
        name: string;
        parent_folder_id?: string | null;
    }
}
