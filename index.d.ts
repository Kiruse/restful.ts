type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Requester = (options: RequestOptions) => Promise<unknown>;
export interface RequestOptions {
    method: Method;
    endpoint: string;
    body?: unknown;
    query?: Record<string, string | number>;
    headers?: Record<string, string>;
}
export type RemainingRequestOptions = Omit<RequestOptions, 'method' | 'endpoint' | 'body'>;
export type RestResource<T> = {
    [id: string | number]: T;
};
export interface RestApiTemplate {
    [key: string | number]: RestApiTemplate | RestApiMethodTemplate;
}
export type RestApiMethodTemplate = ((method: 'GET' | 'DELETE', options?: RemainingRequestOptions) => Promise<any>) | ((method: 'POST' | 'PUT' | 'PATCH', body: any, options?: RemainingRequestOptions) => Promise<any>);
/** `restful` creates a simple interface to your RESTful web API. */
declare function restful<T extends RestApiTemplate>(request: Requester): T;
declare namespace restful {
    var _a: <T extends RestApiTemplate>(options: DefaultRequesterOptions) => T;
    export { _a as default };
}
export default restful;
export { restful };
export interface DefaultRequesterOptions {
    baseUrl: string;
    /** Default headers to set for every request. */
    headers?: Record<string, string>;
    /** Marshalling algorithm, called like `JSON.stringify(marshal(body))` if body is truthy.
     * Marshalling can also be used to convert case. Defaults to identity.
     */
    marshal?(value: any): any;
    /** Unmarshalling algorithm, called like `unmarshal(await response.json())`.
     * Unmarshalling can be used to restore case. Defaults to identity.
     */
    unmarshal?(value: any): any;
}
export declare function createDefaultRequester({ baseUrl, headers: baseHeaders, marshal, unmarshal, }: DefaultRequesterOptions): ({ method, endpoint, body, query, headers, }: RequestOptions) => Promise<any>;
export declare class RestError extends Error {
    readonly response: Response;
    readonly body: string;
    constructor(response: Response, body: string);
}
