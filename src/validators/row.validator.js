const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s-]{7,15}$/;

/**
 * Validates a single parsed CSV row.
 * Expected columns (documented assumption - see README): name, email, phone
 *
 * Returns { valid: boolean, errors: string[] }
 */
function validateRow(row) {
  const errors = [];

  const name = (row.name || '').trim();
  const email = (row.email || '').trim();
  const phone = (row.phone || '').trim();

  if (!name) {
    errors.push('"name" is required.');
  }

  if (!email) {
    errors.push('"email" is required.');
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push('"email" is not a valid email address.');
  }

  if (!phone) {
    errors.push('"phone" is required.');
  } else if (!PHONE_REGEX.test(phone)) {
    errors.push('"phone" is not a valid phone number.');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateRow };
