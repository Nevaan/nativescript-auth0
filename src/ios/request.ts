import { request as httpRequest, HttpRequestOptions, HttpResponse } from 'tns-core-modules/http';

import { Auth0Error } from './auth0Error';
import { Requestable } from './requestable';
import { Response } from './response';
import { Result } from './result';
import { Logger } from './logger';
import { Telemetry } from './telemetry';

/**
 Auth0 API request

 ```
 let request: Request<Credentials, Authentication.Error> = //
 request.start { result in
    //handle result
 }
 ```
 */
export class Request<T, E extends Auth0Error> implements Requestable<T> {

    readonly url: URL;
    readonly method: string;
    readonly handle: (response: Response<E>, callback: (result: Result<T>) => void) => void;
    readonly payload: { [key: string]: any };
    readonly headers: { [key: string]: string };
    readonly logger: Logger | undefined;
    readonly telemetry: Telemetry | undefined;

    constructor(
        url: URL,
        method: string,
        handle: (response: Response<E>, callback: (result: Result<T>) => void) => void,
        payload: { [key: string]: any } = {},
        headers: { [key: string]: string } = {},
        logger: Logger | undefined,
        telemetry: Telemetry
    ) {
        this.url = url;
        this.method = method;
        this.handle = handle;
        this.payload = payload;
        this.headers = headers;
        this.logger = logger;
        this.telemetry = telemetry;
    }

    get request(): HttpRequestOptions {
        const request: HttpRequestOptions = {
            url: this.url.toString(),
            method: this.method,
            headers: {
                'Content-Type': 'application/json'
            },
        };
        if (Object.keys(this.payload).length > 0) {
            request.content = JSON.stringify(this.payload);
        }
        for (const key in this.headers) {
            request.headers[key] = this.headers[key];
        }
        this.telemetry.addTelemetryHeader(request);
        return request;
    }

    /**
     Starts the request to the server

     - parameter callback: called when the request finishes and yield it's result
     */
    public start(callback: (result: Result<T>) => void) {
        const handler = this.handle;
        const request = this.request;
        const logger = this.logger;

        if (logger != null) {
            logger.trace(request);
        }
        httpRequest(request).then((response) => {
            if (logger != null) {
                logger.trace(response);
            }
            handler(new Response(response.content, request, response, undefined, this.eclass), callback);
        }).catch((error) => {
            handler(new Response(undefined, request, undefined, error, this.eclass), callback);
        });
    }
}

/**
 *  A concatenated request, if the first one fails it will yield it's error, otherwise it will return the last request outcome
 */
export class ConcatRequest<F, S, E extends Auth0Error> implements Requestable<S> {
    readonly first: Request<F, E>;
    readonly second: Request<S, E>;

    /**
     Starts the request to the server

     - parameter callback: called when the request finishes and yield it's result
     */
    public start(callback: (result: Result<S>) => void) {
        const second = this.second;
        this.first.start((result) => {
            if (result.failure) {
                callback({
                    failure: result.failure
                });
            } else if (result.success) {
                second.start(callback);
            }
        });
    }
}