const success = (res, data, statusCode = 200) => {
  const body = { success: true };
  if (data !== undefined) {
    body.data = data;
  }
  res.status(statusCode).json(body);
};

module.exports = { success };
