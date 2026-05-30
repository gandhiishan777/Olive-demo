import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { ConversationHistoryTranscriptCommonModelOutput } from "./ConversationHistoryTranscriptCommonModelOutput";
import { DynamicVariableValueTypeOutput } from "./DynamicVariableValueTypeOutput";
import { Llm } from "./Llm";
import { SimulationToolMockBehaviorConfig } from "./SimulationToolMockBehaviorConfig";
import { TestFromConversationMetadataOutput } from "./TestFromConversationMetadataOutput";
export declare const SimulationTestModel: core.serialization.ObjectSchema<serializers.SimulationTestModel.Raw, ElevenLabs.SimulationTestModel>;
export declare namespace SimulationTestModel {
    interface Raw {
        from_conversation_metadata?: TestFromConversationMetadataOutput.Raw | null;
        dynamic_variables?: Record<string, DynamicVariableValueTypeOutput.Raw | null | undefined> | null;
        chat_history?: ConversationHistoryTranscriptCommonModelOutput.Raw[] | null;
        success_condition?: string | null;
        simulation_scenario?: string | null;
        simulation_max_turns?: number | null;
        simulation_environment?: string | null;
        tool_mock_config?: SimulationToolMockBehaviorConfig.Raw | null;
        evaluation_model?: Llm.Raw | null;
        simulated_user_model?: Llm.Raw | null;
    }
}
