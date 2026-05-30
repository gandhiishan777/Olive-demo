import type * as ElevenLabs from "../../../../../api/index";
import * as core from "../../../../../core";
import type * as serializers from "../../../../index";
import { AgentCallLimits } from "../../../../types/AgentCallLimits";
import { AsrConversationalConfig } from "../../../../types/AsrConversationalConfig";
import { BaseTurnConfig } from "../../../../types/BaseTurnConfig";
import { ConversationConfigInput } from "../../../../types/ConversationConfigInput";
import { PrivacyConfigInput } from "../../../../types/PrivacyConfigInput";
import { SpeechEngineConfig } from "../../../../types/SpeechEngineConfig";
import { SpeechEngineConversationInitiationClientDataConfig } from "../../../../types/SpeechEngineConversationInitiationClientDataConfig";
import { TtsConversationalConfigInput } from "../../../../types/TtsConversationalConfigInput";
export declare const CreateSpeechEngineRequest: core.serialization.Schema<serializers.CreateSpeechEngineRequest.Raw, ElevenLabs.CreateSpeechEngineRequest>;
export declare namespace CreateSpeechEngineRequest {
    interface Raw {
        name?: string | null;
        speech_engine: SpeechEngineConfig.Raw;
        asr?: AsrConversationalConfig.Raw | null;
        tts?: TtsConversationalConfigInput.Raw | null;
        turn?: BaseTurnConfig.Raw | null;
        conversation?: ConversationConfigInput.Raw | null;
        privacy?: PrivacyConfigInput.Raw | null;
        call_limits?: AgentCallLimits.Raw | null;
        language?: string | null;
        tags?: string[] | null;
        overrides?: SpeechEngineConversationInitiationClientDataConfig.Raw | null;
    }
}
