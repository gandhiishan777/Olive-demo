import type { BaseClientOptions, BaseRequestOptions } from "../../../../BaseClient";
import { type NormalizedClientOptions } from "../../../../BaseClient";
import * as core from "../../../../core";
import * as ElevenLabs from "../../../index";
import { CompositionPlanClient } from "../resources/compositionPlan/client/Client";
export declare namespace MusicClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class MusicClient {
    protected readonly _options: NormalizedClientOptions<MusicClient.Options>;
    protected _compositionPlan: CompositionPlanClient | undefined;
    constructor(options?: MusicClient.Options);
    get compositionPlan(): CompositionPlanClient;
    /**
     * Generate background music from one or more video files. Videos are combined in order. Optional description and style tags influence the generated music.
     * @throws {@link ElevenLabs.ForbiddenError}
     * @throws {@link ElevenLabs.UnprocessableEntityError}
     */
    videoToMusic(request: ElevenLabs.BodyVideoToMusicV1MusicVideoToMusicPost, requestOptions?: MusicClient.RequestOptions): core.HttpResponsePromise<ReadableStream<Uint8Array>>;
    private __videoToMusic;
    /**
     * Compose a song from a prompt or a composition plan.
     * @throws {@link ElevenLabs.UnprocessableEntityError}
     */
    compose(request?: ElevenLabs.BodyComposeMusicV1MusicPost, requestOptions?: MusicClient.RequestOptions): core.HttpResponsePromise<ReadableStream<Uint8Array>>;
    private __compose;
    /**
     * Compose a song from a prompt or a composition plan.
     * @throws {@link ElevenLabs.UnprocessableEntityError}
     */
    composeDetailed(request?: ElevenLabs.BodyComposeMusicWithADetailedResponseV1MusicDetailedPost, requestOptions?: MusicClient.RequestOptions): core.HttpResponsePromise<ReadableStream<Uint8Array>>;
    private __composeDetailed;
    /**
     * Stream a composed song from a prompt or a composition plan.
     * @throws {@link ElevenLabs.UnprocessableEntityError}
     */
    stream(request?: ElevenLabs.BodyStreamComposedMusicV1MusicStreamPost, requestOptions?: MusicClient.RequestOptions): core.HttpResponsePromise<ReadableStream<Uint8Array>>;
    private __stream;
    /**
     * Upload a music file to be later used for inpainting. Only available to enterprise clients with access to the inpainting feature. Price for uploading is the same as the one for song generation. All uploaded content gets inspected for copyright infringement. If copyrighted content is detected, half of the request cost is still charged.
     *
     * @param {ElevenLabs.BodyUploadMusicV1MusicUploadPost} request
     * @param {MusicClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link ElevenLabs.UnprocessableEntityError}
     *
     * @example
     *     import { createReadStream } from "fs";
     *     await client.music.upload({
     *         file: fs.createReadStream("/path/to/your/file")
     *     })
     */
    upload(request: ElevenLabs.BodyUploadMusicV1MusicUploadPost, requestOptions?: MusicClient.RequestOptions): core.HttpResponsePromise<ElevenLabs.MusicUploadResponse>;
    private __upload;
    /**
     * Separate an audio file into individual stems. This endpoint might have high latency, depending on the length of the audio file.
     * @throws {@link ElevenLabs.UnprocessableEntityError}
     */
    separateStems(request: ElevenLabs.BodyStemSeparationV1MusicStemSeparationPost, requestOptions?: MusicClient.RequestOptions): core.HttpResponsePromise<ReadableStream<Uint8Array>>;
    private __separateStems;
}
