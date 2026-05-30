import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { CustomGuardrailConfigTriggerAction } from "./CustomGuardrailConfigTriggerAction";
import { GuardrailExecutionMode } from "./GuardrailExecutionMode";
export declare const CustomGuardrailConfig: core.serialization.ObjectSchema<serializers.CustomGuardrailConfig.Raw, ElevenLabs.CustomGuardrailConfig>;
export declare namespace CustomGuardrailConfig {
    interface Raw {
        is_enabled?: boolean | null;
        name: string;
        prompt: string;
        execution_mode?: GuardrailExecutionMode.Raw | null;
        trigger_action?: CustomGuardrailConfigTriggerAction.Raw | null;
    }
}
