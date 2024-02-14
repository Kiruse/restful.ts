import { afterAll, expect, test } from 'bun:test';
import restful, { RestResource } from './index';
import { Foo, mockServer } from './mock';

export type MockApi = {
  'hello-world'(method: 'GET'): Promise<string>;
  echo<T>(method: 'POST', body: T): Promise<T>;

  foo: {
    (method: 'POST', body: any): Promise<Foo>;
  } & RestResource<{
    (method: 'GET'): Promise<Foo>;
    (method: 'PUT', body: Omit<Foo, 'id'>): Promise<Foo>;
    name: {
      (method: 'PUT', body: { value: string }): Promise<Foo>;
    }
  }>;
};

const mockApi = restful.default<MockApi>({
  baseUrl: 'http://localhost:3034/api',
});

test('hello-world', async () => {
  expect(await mockApi['hello-world']('GET')).toBe('Hello, World!');
});

test('echo', async () => {
  expect(await mockApi.echo('POST', { msg: 'Hello, World!' })).toEqual({ msg: 'Hello, World!' });
  expect(await mockApi.echo('POST', { data: 'Goodbye, World!' })).toEqual({ data: 'Goodbye, World!' });
});

test('nesting', async () => {
  expect(await mockApi.foo[1]('GET')).toEqual({ id: 1, name: 'Foo 1' });
  expect(await mockApi.foo[1]('PUT', { name: 'Bar' })).toEqual({ id: 1, name: 'Bar' });
  expect(await mockApi.foo[1].name('PUT', { value: 'Bar' })).toEqual({ id: 1, name: 'Bar' });
});

afterAll(() => {
  mockServer.close();
});
