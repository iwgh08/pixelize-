// index.html 점검: 스크립트 문법 + 이미지 처리(CORE) 기능 테스트
// 실행: node tests/check.js   (문제가 있으면 종료 코드 1)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
  if (!cond) failed++;
};

// 1) 모든 <script> 블록 문법 검사
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
check('스크립트 블록 존재', scripts.length > 0);
scripts.forEach((code, i) => {
  try { new vm.Script(code); check(`스크립트 #${i + 1} 문법`, true); }
  catch (e) { check(`스크립트 #${i + 1} 문법`, false, e.message); }
});

// 2) CORE 블록만 잘라 Node에서 실행
if (!html.includes('// CORE-START') || !html.includes('// CORE-END')) {
  check('CORE-START / CORE-END 경계 주석', false);
  process.exit(1);
}
const core = '//' + html.split('// CORE-START')[1].split('// CORE-END')[0];
class ImageData {
  constructor(a, b, c) {
    if (typeof a === 'number') { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); }
    else { this.data = a; this.width = b; this.height = c; }
  }
}
const F = new Function('ImageData', core +
  '; return {downscale, removeBackground, quantize, padImage, addOutline, applyStrokes, analyzeImage};')(ImageData);

const px = (im, x, y) => [...im.data.slice((y * im.width + x) * 4, (y * im.width + x) * 4 + 4)];
// 연회색 배경 + 빨간 몸통(50..150) + 흰 눈(90..110)
const makeChar = (W, H) => {
  const im = new ImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = [250 + (x % 3), 252, 251];
    if (x >= 50 && x < 150 && y >= 50 && y < 150) c = [200, 30, 40];
    if (x >= 90 && x < 110 && y >= 90 && y < 110) c = [255, 255, 255];
    im.data.set([...c, 255], (y * W + x) * 4);
  }
  return im;
};

// 정사각형 칸 + 부분 칸
const a = F.downscale(makeChar(200, 200), 10, 128, true, 5);
check('칸 10px: 200×200 → 20×20', a.width === 20 && a.height === 20);
const b = F.downscale(makeChar(205, 200), 10, 128, true, 5);
check('칸 10px: 205×200 → 21×20 (부분 칸)', b.width === 21 && b.height === 20);

// 점 개수 / 색 고르기 조합
for (const n of [1, 3, 5, 7, 0]) for (const sharp of [true, false]) {
  const im = F.downscale(makeChar(200, 200), 10, 128, sharp, n);
  const body = px(im, 6, 6), eye = px(im, 9, 9);
  check(`점 ${n || '전체'} · ${sharp ? '최다 색' : '평균 색'}: 몸통/눈 색`,
    body[0] === 200 && body[1] === 30 && eye[0] === 255 && eye[1] === 255);
}

// 선 살리기: 흰 바탕의 2px 검은 세로선
const lw = new ImageData(200, 200); lw.data.fill(255);
for (let y = 0; y < 200; y++) for (const x of [104, 105]) lw.data.set([20, 20, 20, 255], (y * 200 + x) * 4);
check('선 살리기 0: 선 사라짐', px(F.downscale(lw, 10, 128, true, 5, 0), 10, 5)[0] > 200);
check('선 살리기 60: 선 남음', px(F.downscale(lw, 10, 128, true, 5, 60), 10, 5)[0] < 50);

// 배경 제거 → 색 클릭 → 붓질 → 외곽선
const img = new ImageData(new Uint8ClampedArray(a.data), 20, 20);
F.removeBackground(img, { auto: true, tol: 10, picks: [], pickMode: 'connected' });
check('배경 자동 제거: 모서리 투명, 안쪽 흰 눈 유지', px(img, 0, 0)[3] === 0 && px(img, 9, 9)[3] === 255);
F.removeBackground(img, { auto: false, tol: 10, picks: [{ r: 255, g: 255, b: 255, fx: 9.5 / 20, fy: 9.5 / 20 }], pickMode: 'connected' });
check('색 클릭: 눈 제거', px(img, 9, 9)[3] === 0);
F.applyStrokes(img, a, [{ erase: true, size: 1, pts: [[6.5 / 20, 6.5 / 20]] }]);
check('지우개 붓질', px(img, 6, 6)[3] === 0);
F.applyStrokes(img, a, [{ erase: false, size: 1, pts: [[6.5 / 20, 6.5 / 20]] }]);
check('복원 붓질', px(img, 6, 6)[3] === 255 && px(img, 6, 6)[0] === 200);
const pal = F.quantize(img, 4);
check('색상 수 제한: 팔레트 ≤ 4색', pal.length > 0 && pal.length <= 4);
const pd = F.padImage(img, 1); F.addOutline(pd, [0, 0, 0], false);
check('외곽선', px(pd, 5, 6)[3] === 255 && px(pd, 5, 6)[0] === 0 && px(pd, 0, 0)[3] === 0);

// 자동 설정 분석
const ch = new ImageData(1000, 1000);
for (let y = 0; y < 1000; y++) for (let x = 0; x < 1000; x++) {
  let c = [208 + (x * 7 % 5), 212, 220];
  if (x >= 350 && x < 650 && y >= 100 && y < 900)
    c = (x < 354 || x >= 646 || y < 104 || y >= 896 || (y >= 400 && y < 403)) ? [20, 20, 30] : [250, 250, 252];
  ch.data.set([...c, 255], (y * 1000 + x) * 4);
}
const an = F.analyzeImage(ch, 64);
check('자동 분석: 캐릭터 영역 ≈ 300×800', Math.abs(an.charW - 300) <= 4 && Math.abs(an.charH - 800) <= 4,
  JSON.stringify(an));
check('자동 분석: 칸 크기와 선 살리기 추천', an.cell >= 2 && an.cell <= 64 && an.lineStrength > 0);

console.log(failed ? `\n${failed}개 실패` : '\n모두 통과');
process.exit(failed ? 1 : 0);
