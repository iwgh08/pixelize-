---
description: 문제가 없는지 점검한 뒤 git add → commit → push
argument-hint: "[커밋 메시지 (생략하면 변경 내용을 보고 자동 작성)]"
allowed-tools: Bash(node tests/check.js), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git remote:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git ls-files:*)
---

변경 사항을 점검하고, 문제가 없을 때만 GitHub(`origin` = https://github.com/iwgh08/pixelize-.git)에 올린다. 사용자에게 하는 설명은 한국어로 한다.

## 1. 현재 상태 확인
- `git status --short`와 `git diff --stat HEAD`로 바뀐 파일을 본다. 첫 커밋 전이면 `git status`만 본다.
- 바뀐 것이 없으면 "올릴 변경 사항이 없습니다"라고 알리고 끝낸다.
- `git remote -v`에 `origin`이 없으면 `git remote add origin https://github.com/iwgh08/pixelize-.git`로 추가한다.

## 2. 점검 (하나라도 실패하면 commit/push 하지 말고 멈춘다)
1. **기능 테스트**: `node tests/check.js`를 실행한다. 스크립트 문법 검사와 이미지 처리 테스트가 들어 있다. 종료 코드가 0이 아니면 실패한 항목을 그대로 보여 주고 멈춘다.
2. **커밋하면 안 되는 파일**: 올라갈 파일 목록에 아래가 있으면 멈추고 사용자에게 물어본다.
   - 비밀번호, API 키, 토큰처럼 보이는 내용이 들어간 파일
   - `.env` 파일
   - 테스트용으로 만든 임시 HTML이나 스크린샷
   - 10MB가 넘는 파일
3. **변경 내용 훑어보기**: `git diff`를 읽고 다음을 확인한다. 이상하면 멈추고 무엇이 걱정되는지 설명한다.
   - 디버그용 `console.log`가 남아 있지 않은지
   - `// CORE-START` / `// CORE-END` 경계 주석이 지워지지 않았는지
   - 의도치 않게 크게 지워진 코드가 없는지

## 3. 커밋
- `git add -A`로 모두 올린다.
- 커밋 메시지:
  - `$ARGUMENTS`가 있으면 그것을 제목으로 쓴다.
  - 없으면 diff를 보고 **한국어로** 한 줄 제목(50자 안팎, 무엇을 왜 바꿨는지)을 쓰고, 필요하면 빈 줄 뒤에 바뀐 점을 2–4줄로 덧붙인다.
  - 메시지 끝에는 빈 줄을 하나 두고 아래 줄을 붙인다.
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    ```
- 여러 줄 메시지는 heredoc으로 넘긴다: `git commit -F - <<'EOF' … EOF`
- pre-commit 훅이 실패하면 `--no-verify`로 건너뛰지 말고, 원인을 고치거나 사용자에게 알린다.

## 4. 푸시
- 현재 브랜치의 업스트림이 없으면 `git push -u origin <브랜치>`, 있으면 `git push`를 실행한다.
- 푸시가 거절되면(원격에 새 커밋이 있는 경우 등) **절대 `--force`로 밀어붙이지 말고**, 상황을 설명한 뒤 어떻게 할지 사용자에게 묻는다.
- 인증 실패 같은 오류는 오류 메시지와 함께 해결 방법(예: GitHub 로그인 창 확인)을 안내한다.

## 5. 결과 보고
짧게 보고한다: 점검 결과(통과 개수), 커밋 제목과 해시, 올라간 파일 수, 푸시한 브랜치와 저장소 주소.
