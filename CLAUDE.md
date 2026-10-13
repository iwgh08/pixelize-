# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

일반 캐릭터 일러스트를 도트(픽셀아트) 게임용 스프라이트로 바꾸는 브라우저 도구다. 사용자는 한국어를 쓰므로 설명과 UI 문구, 코드 주석은 한국어로 쓴다.

`index.html` 파일 하나가 전부다. HTML, CSS, JS가 모두 이 파일에 들어 있고, 빌드 과정, 패키지, 외부 라이브러리가 없다(Canvas API만 사용). 실행은 브라우저로 파일을 여는 것으로 끝난다. VS Code에서 열면 코드만 보이므로, 실행하려면 Windows에서 `Start-Process index.html`을 쓴다(기본 브라우저는 Edge).

## 코드 구조

`<script>`는 두 부분으로 나뉜다.

**1. `// CORE-START` … `// CORE-END`: 순수 이미지 처리**
- DOM을 쓰지 않고 `ImageData`만 다룬다. 이 경계 주석은 테스트에서 이 블록만 잘라 Node로 실행하는 데 쓰이므로 지우지 말 것. 이 블록 안에서는 `document`나 `$`를 쓰면 안 된다.
- 처리 파이프라인(`render()`가 이 순서로 호출한다):
  1. `downscale(src, cell, alphaCut, sharp, samples, lineStrength)`: 원본을 `cell`×`cell` px 정사각형 칸으로 자르고, 칸마다 N×N 격자 점(`samples`, 0이면 모든 픽셀)을 본다.
     - 최다 색(`sharp`)은 15비트 버킷으로 비슷한 색을 묶어 센다. 아니면 알파 가중 평균을 쓴다.
     - 이어서 "선 살리기"를 한다. 칸의 **모든 픽셀** 중 대표색보다 밝기가 `LINE_DARKER` 이상 낮은 픽셀이 일정 비율을 넘으면 그 선 색으로 칸을 채운다.
     - 끝 칸은 부분 칸이 되므로 결과 크기는 `ceil(원본 / cell)`이다.
  2. `removeBackground(img, {auto, tol, picks, pickMode})`: 테두리 배경색을 자동으로 찾아 flood fill로 지우고(`detectBackground`, `floodClear`), 사용자가 클릭한 색도 지운다.
  3. `applyStrokes(img, base, strokes)`: 지우개/복원 붓질. 복원은 배경 제거 **전** 이미지인 `state.base`에서 색을 가져온다.
  4. `quantize(img, n)`: median-cut 팔레트를 만든다.
  5. `padImage` + `addOutline`: 외곽선을 켜면 사방에 1px 여백이 생긴다. 이 여백은 `state.pad`에 저장된다.
- `analyzeImage(src, cellMax)`: 그림을 열 때 자동 설정에 쓰는 추천값(칸 크기, 허용 오차, 선 살리기)을 계산한다. 캐릭터 영역 바깥 사각형의 긴 쪽이 약 120칸이 되도록 칸 크기를 정한다.

**2. UI 부분**
- 전역 `state` 하나에 상태를 모은다.
- 컨트롤 값은 대부분 DOM에서 바로 읽는다(`$('cell').value` 등). 버튼형 선택(`.seg`)의 값만 `state.mode`, `state.samples`, `state.tool` 등에 있다.
- 입력이 바뀌면 `schedule()`(디바운스)이 `render()`를 부른다. 붓질 중에는 `renderSoon()`(rAF)을 쓴다.
- `downscale` 결과는 `state.cacheKey`로 캐시한다. **`downscale`에 영향을 주는 설정을 새로 추가하면 반드시 캐시 키에 넣어야 한다.** 빠뜨리면 값을 바꿔도 화면이 갱신되지 않는다.
- 새 입력 컨트롤을 추가하면 다음 두 곳에도 등록한다.
  - 하단의 `for (const id of [...]) addEventListener('input', schedule)` 목록
  - 라벨을 갱신하는 `syncLabels()`
  - 자동 설정이 그 값을 정한다면 `applyAuto()`에도 넣는다.

**좌표 규칙**
- 클릭한 색(`state.picks`)과 붓질(`state.strokes`)은 **0–1 비율 좌표**로 저장한다. 그래서 칸 크기를 바꿔도 같은 자리를 가리킨다.
- 캔버스 좌표를 이미지 좌표로 바꿀 때는 `canvasToBase()`/`canvasToBaseRaw()`를 쓴다. 외곽선 여백 `state.pad`를 빼 주는 처리가 여기에 들어 있다.
- 되돌리기(`state.history`)는 `{list, item}` 참조로 저장한다. 칩의 ×처럼 다른 경로로 이미 지워진 항목은 건너뛴다.

**결과 칸 레이아웃**
`.stage`는 `justify-content: center` 대신 자식에 `margin: auto`를 준다. `center`를 쓰면 확대해서 그림이 칸보다 커졌을 때 왼쪽과 위가 잘려 스크롤할 수 없다.

## 테스트

`node tests/check.js`: 스크립트 문법 검사와 CORE 기능 테스트를 한 번에 돌린다. 실패하면 종료 코드 1을 낸다. `/ship` 명령(`.claude/commands/ship.md`)이 commit/push 전에 이것을 실행한다. CORE 함수의 동작이나 시그니처를 바꾸면 이 파일의 테스트도 함께 고친다.

검증 방법은 두 가지다.

- **처리 로직 (Node, `tests/check.js`가 쓰는 방식)**: `index.html`에서 `// CORE-START`부터 `// CORE-END`까지 잘라낸 뒤, 간단한 `ImageData` 클래스를 주입해 `new Function`으로 실행한다. 그리고 합성 이미지에 대해 결과 픽셀을 검사한다. 잘라낸 문자열은 `'//' + html.split('// CORE-START')[1].split('// CORE-END')[0]`처럼 앞에 `//`를 붙여야 한다. 시작 주석의 나머지 부분이 코드로 해석되기 때문이다.
  ```js
  class ImageData { constructor(a,b,c){ if(typeof a==='number'){this.width=a;this.height=b;this.data=new Uint8ClampedArray(a*b*4);} else {this.data=a;this.width=b;this.height=c;} } }
  const F = new Function('ImageData', core + '; return {downscale, removeBackground, quantize, padImage, addOutline, applyStrokes, analyzeImage};')(ImageData);
  ```
- **화면 (헤드리스 Edge)**: `index.html`의 `</body>` 앞에 테스트 스크립트를 끼운 복사본을 만든다. 이 스크립트는 캔버스로 그린 그림이나 data URL로 넣은 그림을 `loadFile(new File(...))`로 불러온다. 그 뒤 아래처럼 캡처하거나 `document.title`에 결과를 적어 `--dump-dom`으로 읽는다.
  ```
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --window-size=1300,850 --virtual-time-budget=4000 --screenshot=out.png file:///.../test.html
  ```
  - 복사본은 Node의 `String.replace`로 만든다. `sed`로 끼우면 `#`, `&`가 깨진다.
  - 합성 `PointerEvent`의 `pointerId`가 실제로 없는 포인터면 `setPointerCapture`가 예외를 던진다. 그래서 코드에서는 try/catch로 감싸 두었다.
