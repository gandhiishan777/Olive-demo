import type * as ElevenLabs from "../../../../api/index";
import * as core from "../../../../core";
import type * as serializers from "../../../index";
import { RttAudioPayload } from "../../../types/RttAudioPayload";
import { RttErrorPayload } from "../../../types/RttErrorPayload";
import { RttFinalTranscriptPayload } from "../../../types/RttFinalTranscriptPayload";
import { RttPartialTranscriptPayload } from "../../../types/RttPartialTranscriptPayload";
import { RttSessionStartedPayload } from "../../../types/RttSessionStartedPayload";
import { RttStatusPayload } from "../../../types/RttStatusPayload";
import { RttTranslationPayload } from "../../../types/RttTranslationPayload";
export declare const ReceiveRttMessage: core.serialization.Schema<serializers.ReceiveRttMessage.Raw, ElevenLabs.ReceiveRttMessage>;
export declare namespace ReceiveRttMessage {
    type Raw = RttSessionStartedPayload.Raw | RttStatusPayload.Raw | RttPartialTranscriptPayload.Raw | RttFinalTranscriptPayload.Raw | RttTranslationPayload.Raw | RttAudioPayload.Raw | RttErrorPayload.Raw;
}
