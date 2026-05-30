import type * as ElevenLabs from "../../api/index";
import * as core from "../../core";
import type * as serializers from "../index";
import { AuthConnectionDependencies } from "./AuthConnectionDependencies";
import { PrivateKeyJwtResponseAlgorithm } from "./PrivateKeyJwtResponseAlgorithm";
export declare const PrivateKeyJwtResponse: core.serialization.ObjectSchema<serializers.PrivateKeyJwtResponse.Raw, ElevenLabs.PrivateKeyJwtResponse>;
export declare namespace PrivateKeyJwtResponse {
    interface Raw {
        name: string;
        provider: string;
        algorithm?: PrivateKeyJwtResponseAlgorithm.Raw | null;
        key_id?: string | null;
        issuer: string;
        audience: string;
        subject: string;
        expiration_seconds?: number | null;
        extra_params?: Record<string, string> | null;
        id: string;
        used_by?: AuthConnectionDependencies.Raw | null;
    }
}
