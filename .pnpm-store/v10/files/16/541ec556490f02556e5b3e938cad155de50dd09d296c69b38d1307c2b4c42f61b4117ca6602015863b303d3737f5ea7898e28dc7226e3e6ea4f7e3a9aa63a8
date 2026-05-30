import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { AgentMetadata } from "./AgentMetadata";
import { ChatSourceMedium } from "./ChatSourceMedium";
import { ContextualUpdateInfo } from "./ContextualUpdateInfo";
import { ConversationHistoryMultivoiceMessageModel } from "./ConversationHistoryMultivoiceMessageModel";
import { ConversationHistoryTranscriptFileInputResponseModel } from "./ConversationHistoryTranscriptFileInputResponseModel";
import { ConversationHistoryTranscriptResponseModelRole } from "./ConversationHistoryTranscriptResponseModelRole";
import { ConversationHistoryTranscriptResponseModelToolResultsItem } from "./ConversationHistoryTranscriptResponseModelToolResultsItem";
import { ConversationHistoryTranscriptToolCallCommonModelOutput } from "./ConversationHistoryTranscriptToolCallCommonModelOutput";
import { ConversationTurnMetrics } from "./ConversationTurnMetrics";
import { LlmUsageOutput } from "./LlmUsageOutput";
import { RagRetrievalInfo } from "./RagRetrievalInfo";
import { UserFeedback } from "./UserFeedback";
export declare const ConversationHistoryTranscriptResponseModel: core.serialization.ObjectSchema<serializers.ConversationHistoryTranscriptResponseModel.Raw, ElevenLabs.ConversationHistoryTranscriptResponseModel>;
export declare namespace ConversationHistoryTranscriptResponseModel {
    interface Raw {
        role: ConversationHistoryTranscriptResponseModelRole.Raw;
        agent_metadata?: AgentMetadata.Raw | null;
        message?: string | null;
        multivoice_message?: ConversationHistoryMultivoiceMessageModel.Raw | null;
        tool_calls?: ConversationHistoryTranscriptToolCallCommonModelOutput.Raw[] | null;
        tool_results?: ConversationHistoryTranscriptResponseModelToolResultsItem.Raw[] | null;
        feedback?: UserFeedback.Raw | null;
        llm_override?: string | null;
        time_in_call_secs: number;
        conversation_turn_metrics?: ConversationTurnMetrics.Raw | null;
        rag_retrieval_info?: RagRetrievalInfo.Raw | null;
        llm_usage?: LlmUsageOutput.Raw | null;
        interrupted?: boolean | null;
        original_message?: string | null;
        source_medium?: ChatSourceMedium.Raw | null;
        source_event_id?: number | null;
        used_static_kb_document_ids?: string[] | null;
        file_input?: ConversationHistoryTranscriptFileInputResponseModel.Raw | null;
        contextual_update_info?: ContextualUpdateInfo.Raw | null;
    }
}
