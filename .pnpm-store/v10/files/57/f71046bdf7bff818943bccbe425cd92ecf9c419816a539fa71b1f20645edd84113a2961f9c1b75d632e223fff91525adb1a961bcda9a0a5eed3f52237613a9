import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { AgentFailureResponseExample } from "./AgentFailureResponseExample";
import { AgentSuccessfulResponseExample } from "./AgentSuccessfulResponseExample";
import { ConversationHistoryTranscriptCommonModelOutput } from "./ConversationHistoryTranscriptCommonModelOutput";
import { DynamicVariableValueTypeOutput } from "./DynamicVariableValueTypeOutput";
import { TestFromConversationMetadataOutput } from "./TestFromConversationMetadataOutput";
export declare const ResponseUnitTestModel: core.serialization.ObjectSchema<serializers.ResponseUnitTestModel.Raw, ElevenLabs.ResponseUnitTestModel>;
export declare namespace ResponseUnitTestModel {
    interface Raw {
        from_conversation_metadata?: TestFromConversationMetadataOutput.Raw | null;
        dynamic_variables?: Record<string, DynamicVariableValueTypeOutput.Raw | null | undefined> | null;
        chat_history?: ConversationHistoryTranscriptCommonModelOutput.Raw[] | null;
        success_condition?: string | null;
        success_examples?: AgentSuccessfulResponseExample.Raw[] | null;
        failure_examples?: AgentFailureResponseExample.Raw[] | null;
    }
}
