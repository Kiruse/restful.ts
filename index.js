"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestError = exports.createDefaultRequester = exports.restful = void 0;
/** `restful` creates a simple interface to your RESTful web API. */
function restful(request) {
    const createEndpoint = (endpoint) => new Proxy(async (method, ...args) => {
        if (method === 'GET' || method === 'DELETE') {
            const [opts] = args;
            return await request({
                method,
                endpoint,
                ...opts,
            });
        }
        else {
            const [body, opts] = args;
            return await request({
                method,
                endpoint,
                body,
                ...opts,
            });
        }
    }, {
        get(_, prop) {
            return createEndpoint(`${endpoint}/${prop}`);
        },
    });
    return new Proxy({}, {
        get: (_, prop) => createEndpoint(prop),
    });
}
exports.default = restful;
exports.restful = restful;
/** Create a slightly biased but commonly encountered implementation of a RESTful API.
 *
 * The bias includes:
 * - JSON request & response bodies
 * - Normalizing endpoint URLs to the form of `${baseUrl}/${endpoint}`
 * - Throws `RestError` on non-2xx responses. `RestError` consumes the response body as raw text.
 * - Returns JSON-parsed response bodies, not the intermittent `Response` object, but the `Response` object is available on the `RestError`
 */
restful.default = (options) => restful(createDefaultRequester(options));
function createDefaultRequester({ baseUrl, headers: baseHeaders = {}, marshal = (value) => value, unmarshal = (value) => value, }) {
    return async function ({ method, endpoint, body, query = {}, headers = {}, }) {
        const params = new URLSearchParams(Object.entries(query)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => [key, value.toString()]));
        const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}${params.size ? `?${params}` : ''}`;
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...baseHeaders,
                ...headers,
            },
            body: body ? JSON.stringify(marshal(body)) : undefined,
        });
        if (!response.ok)
            throw new RestError(response, await response.text());
        return unmarshal(await response.json());
    };
}
exports.createDefaultRequester = createDefaultRequester;
class RestError extends Error {
    constructor(response, body) {
        super(`${response.url} ${response.status} ${response.statusText}: ${body}`);
        this.response = response;
        this.body = body;
        this.name = 'RestError';
    }
}
exports.RestError = RestError;
//# sourceMappingURL=index.js.map