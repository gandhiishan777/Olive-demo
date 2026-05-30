import type { BaseClientOptions, BaseRequestOptions } from "../../../../../../../../BaseClient";
import { type NormalizedClientOptions } from "../../../../../../../../BaseClient";
import * as core from "../../../../../../../../core";
import * as ElevenLabs from "../../../../../../../index";
export declare namespace TopicsClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class TopicsClient {
    protected readonly _options: NormalizedClientOptions<TopicsClient.Options>;
    constructor(options?: TopicsClient.Options);
    /**
     * Returns the latest topic discovery run results for a given agent.
     *
     * @param {string} agent_id - ID of the agent
     * @param {TopicsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link ElevenLabs.UnprocessableEntityError}
     *
     * @example
     *     await client.conversationalAi.conversations.topics.get("agent_id")
     */
    get(agent_id: string, requestOptions?: TopicsClient.RequestOptions): core.HttpResponsePromise<ElevenLabs.GetAgentTopicsResponseModel>;
    private __get;
}
