import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { ConstantSchemaOverride } from "./ConstantSchemaOverride";
import { DynamicVariableSchemaOverride } from "./DynamicVariableSchemaOverride";
import { LlmSchemaOverride } from "./LlmSchemaOverride";
export declare const McpToolConfigOverrideOutputInputOverridesValue: core.serialization.Schema<serializers.McpToolConfigOverrideOutputInputOverridesValue.Raw, ElevenLabs.McpToolConfigOverrideOutputInputOverridesValue>;
export declare namespace McpToolConfigOverrideOutputInputOverridesValue {
    type Raw = McpToolConfigOverrideOutputInputOverridesValue.Constant | McpToolConfigOverrideOutputInputOverridesValue.DynamicVariable | McpToolConfigOverrideOutputInputOverridesValue.Llm;
    interface Constant extends ConstantSchemaOverride.Raw {
        source: "constant";
    }
    interface DynamicVariable extends DynamicVariableSchemaOverride.Raw {
        source: "dynamic_variable";
    }
    interface Llm extends LlmSchemaOverride.Raw {
        source: "llm";
    }
}
