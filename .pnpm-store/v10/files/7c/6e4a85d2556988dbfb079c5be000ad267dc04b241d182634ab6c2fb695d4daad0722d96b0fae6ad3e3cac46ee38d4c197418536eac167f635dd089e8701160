import type { BaseClientOptions, BaseRequestOptions } from "../../../../../../../../BaseClient";
import { type NormalizedClientOptions } from "../../../../../../../../BaseClient";
import * as core from "../../../../../../../../core";
import * as ElevenLabs from "../../../../../../../index";
export declare namespace AnalysisClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class AnalysisClient {
    protected readonly _options: NormalizedClientOptions<AnalysisClient.Options>;
    constructor(options?: AnalysisClient.Options);
    /**
     * Run the analysis for a conversation using the agent's current evaluation criteria and data collection settings.
     *
     * @param {string} conversation_id - ID of the conversation
     * @param {AnalysisClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link ElevenLabs.UnprocessableEntityError}
     *
     * @example
     *     await client.conversationalAi.conversations.analysis.run("conversation_id")
     */
    run(conversation_id: string, requestOptions?: AnalysisClient.RequestOptions): core.HttpResponsePromise<ElevenLabs.GetConversationResponseModel>;
    private __run;
}
