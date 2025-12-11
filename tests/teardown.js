/**
 * Jest teardown file - runs after all tests complete
 */

const db = require('../db');

module.exports = async () => {
  // Close database connections to allow Jest to exit cleanly
  await db.close();
};
