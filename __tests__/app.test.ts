import request from 'supertest';
import app from '../src/internal/app';

describe('Test Express App', () => {
  it('should respond with 404 for unknown routes', async () => {
    const response = await request(app).get('/unknown-route');
    expect(response.status).toBe(404);
  });

  it('should handle errors gracefully', async () => {
    const response = await request(app).get('/cause-error');
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
  });

  it('should have Swagger setup if enabled', async () => {
    if (process.env.SWAGGER !== 'false') {
      const response = await request(app).get('/api-docs/');
      expect(response.status).toBe(200);
    }
  });

  it('should start the server and listen on the specified port', async () => {
    const port = process.env.SERVER_PORT || 3000;
    const server = app.listen(port, () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        expect(address.port).toBe(port);
      }
    });
    server.close();
  });
});
