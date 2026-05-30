import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { ConversationHistoryTranscriptCommonModelInput } from "./ConversationHistoryTranscriptCommonModelInput";
import { DynamicVariableValueTypeInput } from "./DynamicVariableValueTypeInput";
import { Llm } from "./Llm";
import { SimulationToolMockBehaviorConfig } from "./SimulationToolMockBehaviorConfig";
import { TestFromConversationMetadataInput } from "./TestFromConversationMetadataInput";
export declare const UpdateSimulationTestRequest: core.serialization.ObjectSchema<serializers.UpdateSimulationTestRequest.Raw, ElevenLabs.UpdateSimulationTestRequest>;
export declare namespace UpdateSimulationTestRequest {
    interface Raw {
        from_conversation_metadata?: TestFromConversationMetadataInput.Raw | null;
        dynamic_variables?: Record<string, DynamicVariableValueTypeInput.Raw | null | undefined> | null;
        chat_history?: ConversationHistoryTranscriptCommonModelInput.Raw[] | null;
        success_condition?: string | null;
        simulation_scenario?: string | null;
        simulation_max_turns?: number | null;
        simulation_environment?: string | null;
        tool_mock_config?: SimulationToolMockBehaviorConfig.Raw | null;
        evaluation_model?: Llm.Raw | null;
        simulated_user_model?: Llm.Raw | null;
        name: string;
        parent_folder_id?: string | null;
    }
}
