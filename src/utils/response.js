function success(res, statusCode, data) {
  return res.status(statusCode).json({ success: true, data });
}

function failure(res, statusCode, message, errors = []) {
  return res.status(statusCode).json({ success: false, message, errors });
}

module.exports = { success, failure };
