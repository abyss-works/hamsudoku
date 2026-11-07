// Node 서버의 연결 유지 시간 설정. ingress-nginx는 업스트림 연결을 최대 60초까지 재사용한다.
// 서버가 그보다 먼저 유휴 연결을 닫으면 닫히는 순간 같은 연결로 보낸 요청이 502가 되므로,
// 서버의 keepAliveTimeout을 프록시보다 길게 두어 연결을 닫는 쪽이 프록시가 되게 한다.
// Next standalone의 server.js는 headersTimeout을 설정하지 않아 start.cjs가 server.js보다 먼저 install을 호출한다.
const http = require('node:http');

const KEEP_ALIVE_TIMEOUT_MS = 65_000;
// headersTimeout은 keepAliveTimeout보다 길어야 Node가 유휴 연결을 먼저 끊지 않는다.
const HEADERS_TIMEOUT_MS = 66_000;

/** http.Server#listen이 호출될 때 두 타임아웃을 적용한다. 원래 동작을 되돌리는 함수를 반환한다. */
function install() {
  const original = http.Server.prototype.listen;
  http.Server.prototype.listen = function listen(...args) {
    this.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
    this.headersTimeout = HEADERS_TIMEOUT_MS;
    return original.apply(this, args);
  };
  return () => {
    http.Server.prototype.listen = original;
  };
}

module.exports = { install, KEEP_ALIVE_TIMEOUT_MS, HEADERS_TIMEOUT_MS };
