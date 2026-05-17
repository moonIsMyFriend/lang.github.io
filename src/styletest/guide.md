Js, css, html 을 모두 한꺼번에 난독화

1. 필요한 패키지 설치
npm install -g html-minifier-terser clean-css-cli javascript-obfuscator

2. build_publish.js 생성

3. 폴더 구조
project/
  build_publish.js
  src/
    index.html
    css/
      style.css
    js/
      app.js
    img/
      logo.png

4. 실행
node build_publish.js

5. 결과
publish/
  index.html
  css/
    style.css
  js/
    app.js
  img/
    logo.png