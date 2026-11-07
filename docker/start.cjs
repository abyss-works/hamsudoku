// 컨테이너 진입점. HTTP 타임아웃을 적용한 뒤 Next standalone 서버를 시작한다.
require('./httpTimeouts.cjs').install();
require('./server.js');
