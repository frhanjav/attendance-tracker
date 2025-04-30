import express from 'express';
import testRouter from './src/test-router';

const app = express();
app.use('/api', testRouter);

app.listen(3000, () => {
  console.log('Test app listening on port 3000');
});