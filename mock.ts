/////////////////////////////////////////////////
// mock express server for unit testing
import express from 'express';

export interface Foo {
  id: number;
  name: string;
}

const app = express();
app.use(express.json());

app.get('/api/hello-world', (req, res) => {
  res.json('Hello, World!');
});

app.post('/api/echo', (req, res) => {
  res.status(200).json(req.body);
});

app.get('/api/foo/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const name = `Foo ${id}`;
  res.json({ id, name });
});

app.post('/api/foo', (req, res) => {
  res.json(req.body);
});

app.put('/api/foo/:id', (req, res) => {
  const id = parseInt(req.params.id);
  res.json({ id, ...req.body });
});

app.put('/api/foo/:id/name', (req, res) => {
  const id = parseInt(req.params.id);
  res.json({ id, name: req.body.value });
});

app.get('/api/morphing', (req, res) => {
  res.json({ msg: 'Hello, World!' });
});

export const mockServer = app.listen(3034);
