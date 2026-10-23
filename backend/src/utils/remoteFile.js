const https = require('https');
const http = require('http');

// Opens a readable stream to a remote http(s) URL (used to proxy downloads so
// files download from our own API instead of the external storage host).
// Follows up to 3 redirects.
const openRemoteStream = (url, redirects = 0) =>
  new Promise((resolve, reject) => {
    const client = String(url).startsWith('https://') ? https : http;
    const request = client.get(url, (remote) => {
      if (
        redirects < 3 &&
        remote.statusCode >= 300 &&
        remote.statusCode < 400 &&
        remote.headers.location
      ) {
        remote.resume();
        const next = new URL(remote.headers.location, url).toString();
        resolve(openRemoteStream(next, redirects + 1));
        return;
      }
      resolve(remote);
    });
    request.on('error', reject);
  });

module.exports = { openRemoteStream };
