class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status || 502;
  }
}

module.exports = { UpstreamError };
