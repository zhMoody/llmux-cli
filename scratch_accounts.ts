import { db } from './src/db/index.js';
console.log(db.query('SELECT * FROM accounts').all());
console.log(db.query('SELECT * FROM providers').all());
