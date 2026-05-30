import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { PronunciationDictionaryLocator } from "./PronunciationDictionaryLocator";
import { TextToDialogueWebsocketVoiceInput } from "./TextToDialogueWebsocketVoiceInput";
export declare const TextToDialogueWebsocketClientMessage: core.serialization.ObjectSchema<serializers.TextToDialogueWebsocketClientMessage.Raw, ElevenLabs.TextToDialogueWebsocketClientMessage>;
export declare namespace TextToDialogueWebsocketClientMessage {
    interface Raw {
        inputs?: TextToDialogueWebsocketVoiceInput.Raw[] | null;
        flush?: boolean | null;
        close_socket?: boolean | null;
        keep_alive?: boolean | null;
        xi_api_key?: string | null;
        authorization?: string | null;
        single_use_token?: string | null;
        voices?: string[] | null;
        voice_settings?: Record<string, unknown> | null;
        pronunciation_dictionary_locators?: PronunciationDictionaryLocator.Raw[] | null;
    }
}
