import { CustomerApplication } from './customer-application.js';

CustomerApplication.create()
  .then((app: CustomerApplication) => {
    app.express.listen(3011);
    console.log(`Server listening  http://localhost:${3011}`);
    console.log(`    http://localhost:${3011}/$docs`);
  })
  .catch(e => console.error(e));
