import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { ConversationInitiationSource } from "./ConversationInitiationSource";
import { ConversationSummaryResponseModelStatus } from "./ConversationSummaryResponseModelStatus";
import { EvaluationSuccessResult } from "./EvaluationSuccessResult";
import { TelephonyDirection } from "./TelephonyDirection";
export declare const ConversationSummaryResponseModel: core.serialization.ObjectSchema<serializers.ConversationSummaryResponseModel.Raw, ElevenLabs.ConversationSummaryResponseModel>;
export declare namespace ConversationSummaryResponseModel {
    interface Raw {
        agent_id: string;
        branch_id?: string | null;
        version_id?: string | null;
        agent_name?: string | null;
        conversation_id: string;
        start_time_unix_secs: number;
        call_duration_secs: number;
        message_count: number;
        status: ConversationSummaryResponseModelStatus.Raw;
        termination_reason?: string | null;
        call_successful: EvaluationSuccessResult.Raw;
        transcript_summary?: string | null;
        call_summary_title?: string | null;
        main_language?: string | null;
        conversation_initiation_source?: ConversationInitiationSource.Raw | null;
        tool_names?: string[] | null;
        direction?: TelephonyDirection.Raw | null;
        rating?: number | null;
    }
}
